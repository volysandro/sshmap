(ns sshmap.config
  (:require [clojure.edn :as edn]
            [clojure.java.io :as io]
            [cheshire.core :as json]))

(def defaults
  {:port             7070
   :poll-interval-ms 3000
   :demo             false
   :origin           nil})   ; nil → auto-detect via ip-api.com

(defn load-file-config []
  (let [f (io/file (System/getProperty "user.home") ".sshmap.edn")]
    (when (.exists f)
      (edn/read-string (slurp f)))))

;; Example ~/.sshmap.edn:
;; {:port 8080
;;  :origin {:id "origin" :label "home-lab" :city "Berlin" :country "DE" :lat 52.52 :lng 13.41}}

(defn load-config []
  (merge defaults (or (load-file-config) {})))

(defn detect-origin []
  (try
    (let [body (slurp "http://ip-api.com/json/?fields=status,city,countryCode,lat,lon")
          d    (json/parse-string body true)]
      (when (= "success" (:status d))
        {:id      "origin"
         :label   (.. java.net.InetAddress getLocalHost getHostName)
         :city    (or (:city d) "Unknown")
         :country (or (:countryCode d) "??")
         :lat     (double (or (:lat d) 0.0))
         :lng     (double (or (:lon d) 0.0))}))
    (catch Exception _
      {:id "origin" :label "workstation" :city "Unknown" :country "??" :lat 0.0 :lng 0.0})))

(defn get-origin
  "Returns origin map. Uses explicit config if present, otherwise auto-detects."
  [config]
  (or (:origin config) (detect-origin)))
