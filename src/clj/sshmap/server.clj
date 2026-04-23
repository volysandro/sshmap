(ns sshmap.server
  (:require [org.httpkit.server :as http]
            [compojure.core :refer [GET routes]]
            [compojure.route :as route]
            [ring.middleware.content-type :refer [wrap-content-type]]
            [ring.middleware.not-modified :refer [wrap-not-modified]]
            [ring.util.response :refer [resource-response content-type]]
            [cheshire.core :as json]
            [clojure.string :as str]
            [sshmap.sessions :as sessions]))

;; ── WebSocket client registry ─────────────────────────────────────────────────

(def ^:private clients (atom #{}))

(defn- broadcast! [data]
  (let [msg (json/generate-string data)]
    (doseq [ch @clients]
      (try
        (http/send! ch msg)
        (catch Exception _
          (swap! clients disj ch))))))

(defn- ws-handler [origin demo? req]
  (http/with-channel req ch
    (swap! clients conj ch)
    (http/on-close ch (fn [_] (swap! clients disj ch)))
    ;; Push initial state immediately on connect
    (http/send! ch (json/generate-string
                     {:type     "init"
                      :origin   origin
                      :sessions (sessions/get-sessions demo?)}))))

;; ── Static file serving ───────────────────────────────────────────────────────

(defn- wrap-jsx-content-type [handler]
  (fn [req]
    (let [resp (handler req)]
      (if (and resp (str/ends-with? (or (:uri req) "") ".jsx"))
        (assoc-in resp [:headers "Content-Type"] "text/javascript; charset=utf-8")
        resp))))

(defn make-app [origin demo?]
  (-> (routes
        (GET "/ws" req (ws-handler origin demo? req))
        (GET "/" []
          (-> (resource-response "index.html" {:root "public"})
              (content-type "text/html; charset=utf-8")))
        (route/resources "/" {:root "public"}))
      wrap-jsx-content-type
      wrap-content-type
      wrap-not-modified))

;; ── Background broadcaster ────────────────────────────────────────────────────

(def ^:private broadcaster (atom nil))
(def ^:private cleanup-counter (atom 0))

(defn stop-broadcaster! []
  (when-let [f @broadcaster]
    (future-cancel f)
    (reset! broadcaster nil)))

(defn start-broadcaster! [origin demo? poll-ms]
  (stop-broadcaster!)
  (reset! broadcaster
    (future
      (try
        (loop []
          (Thread/sleep poll-ms)
          (try
            (broadcast! {:type "sessions" :sessions (sessions/get-sessions demo?)})
            (when (zero? (mod (swap! cleanup-counter inc) 30))
              (sessions/clear-registry!))
            (catch Exception e
              (println "broadcaster error:" (.getMessage e))))
          (recur))
        (catch InterruptedException _)))))

;; ── Server lifecycle ──────────────────────────────────────────────────────────

(def ^:private stop-fn (atom nil))

(defn start! [config origin]
  (let [port  (:port config 7070)
        demo? (:demo config false)
        poll  (:poll-interval-ms config 3000)
        app   (make-app origin demo?)
        stop  (http/run-server app {:port port :thread 4})]
    (reset! stop-fn stop)
    (start-broadcaster! origin demo? poll)
    (println (str "sshmap listening on http://localhost:" port
                  (when demo? "  [demo mode]")))
    {:port port :stop-fn stop}))

(defn stop! []
  (stop-broadcaster!)
  (when-let [f @stop-fn]
    (f)
    (reset! stop-fn nil)))
