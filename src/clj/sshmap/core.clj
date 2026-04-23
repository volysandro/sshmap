(ns sshmap.core
  (:require [clojure.tools.cli :refer [parse-opts]]
            [sshmap.config :as config]
            [sshmap.server :as server])
  (:gen-class))

(def cli-options
  [["-p" "--port PORT" "HTTP port to listen on"
    :default nil
    :parse-fn #(Integer/parseInt %)]
   ["-d" "--demo" "Show sample sessions instead of live SSH detection"]
   ["-h" "--help" "Show this help"]])

(defn -main [& args]
  (let [{:keys [options errors summary]} (parse-opts args cli-options)]
    (when (:help options)
      (println "sshmap — SSH connection map\n")
      (println "Usage: clj -M:run [options]\n")
      (println summary)
      (System/exit 0))
    (when (seq errors)
      (run! println errors)
      (System/exit 1))
    (let [cfg    (cond-> (config/load-config)
                   (:port options) (assoc :port (:port options))
                   (:demo options) (assoc :demo true))
          _      (println "Detecting origin...")
          origin (config/get-origin cfg)]
      (println (str "Origin: " (:city origin) ", " (:country origin)))
      (server/start! cfg origin)
      ;; Block the main thread — server runs on daemon threads.
      @(promise))))
