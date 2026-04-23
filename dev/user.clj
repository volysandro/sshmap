(ns user
  "REPL conveniences. Load with: clj -M:dev:nrepl
   Then connect your editor to the printed nREPL port."
  (:require [sshmap.config  :as config]
            [sshmap.server  :as server]
            [sshmap.sessions :as sessions]))

(defonce state (atom {:config nil :origin nil}))

(defn start!
  "Start the server. Re-uses last config if no args given."
  ([] (start! (config/load-config)))
  ([cfg]
   (let [origin (config/get-origin cfg)]
     (swap! state assoc :config cfg :origin origin)
     (server/start! cfg origin)
     (println "Open http://localhost:" (:port cfg 7070)))))

(defn stop! []
  (server/stop!)
  :stopped)

(defn restart! []
  (stop!)
  (start! (or (:config @state) (config/load-config))))

(defn demo! []
  (stop!)
  (start! (assoc (or (:config @state) (config/load-config)) :demo true)))

;; Quick inspection helpers
(defn sessions [] (sessions/get-sessions (:demo (:config @state) false)))
(defn origin  [] (:origin @state))
