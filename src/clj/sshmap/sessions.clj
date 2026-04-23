(ns sshmap.sessions
  (:require [clojure.java.shell :refer [sh]]
            [clojure.string :as str]
            [cheshire.core :as json]))

;; ── Geolocation ──────────────────────────────────────────────────────────────

(def ^:private geo-cache (atom {}))

(defn- geolocate [ip]
  (or (get @geo-cache ip)
      (try
        (let [body (slurp (str "http://ip-api.com/json/" ip
                               "?fields=status,city,country,countryCode,lat,lon,regionName"))
              d    (json/parse-string body true)]
          (when (= "success" (:status d))
            (let [geo {:city    (or (:city d) "Unknown")
                       :country (or (:countryCode d) "??")
                       :region  (or (:regionName d) "Unknown")
                       :lat     (double (or (:lat d) 0.0))
                       :lng     (double (or (:lon d) 0.0))}]
              (swap! geo-cache assoc ip geo)
              geo)))
        (catch Exception _
          {:city "Unknown" :country "??" :region "Unknown" :lat 0.0 :lng 0.0}))))

(defn- resolve-hostname [ip]
  (try
    (.getCanonicalHostName (java.net.InetAddress/getByName ip))
    (catch Exception _ ip)))

;; ── Process info (Java 9+ ProcessHandle API) ─────────────────────────────────

(defn- process-info [pid]
  (try
    (let [opt (java.lang.ProcessHandle/of (long pid))]
      (when (.isPresent opt)
        (let [info      (.info (.get opt))
              args-opt  (.arguments info)
              start-opt (.startInstant info)]
          {:cmd        (when (.isPresent args-opt)
                         (str/join " " (.get args-opt)))
           :started-at (when (.isPresent start-opt)
                         (.toEpochMilli (.get start-opt)))})))
    (catch Exception _ nil)))

;; ── Connection detection ──────────────────────────────────────────────────────

(def ^:private session-registry
  ;; local-port → started-at (ms). Tracks when we first saw each session.
  (atom {}))

(defn- os-type []
  (let [os (str/lower-case (System/getProperty "os.name" ""))]
    (cond
      (str/includes? os "linux") :linux
      (str/includes? os "mac")   :macos
      :else                      :unknown)))

(defn- parse-ss-line
  "Parse a line from `ss -tnp state established` output.
   Returns {:local-port N :remote-ip S :pid N} or nil."
  [line]
  (when (and (re-find #"\"ssh\"" line)
             (not (re-find #"\"sshd\"" line)))
    (when-let [[_ _local-ip local-port peer-ip]
               (re-find
                 ;; Match IPv4 addrs: local-ip:local-port  peer-ip:peer-port
                 #"(\d{1,3}(?:\.\d{1,3}){3}):(\d+)\s+(\d{1,3}(?:\.\d{1,3}){3}):\d+"
                 line)]
      (let [pid-m (re-find #"pid=(\d+)" line)]
        {:local-port (Integer/parseInt local-port)
         :remote-ip  peer-ip
         :pid        (when pid-m (Long/parseLong (second pid-m)))}))))

(defn- connections-linux []
  (let [{:keys [exit out]} (sh "ss" "-tnp" "state" "established")]
    (when (zero? exit)
      (keep parse-ss-line (str/split-lines out)))))

(defn- parse-lsof-line
  "Parse a line from `lsof -iTCP -nP -sTCP:ESTABLISHED` on macOS.
   Format: ssh  PID  USER  FD  TYPE  DEVICE  ... TCP local:port->remote:port (ESTABLISHED)"
  [line]
  (let [parts (str/split (str/trim line) #"\s+")]
    (when (= "ssh" (first parts))
      (when-let [[_ local-port peer-ip]
                 (re-find #"->(\d{1,3}(?:\.\d{1,3}){3}):(\d+)" line)]
        ;; In lsof output the arrow is  local->remote, captured groups are peer-ip, peer-port.
        ;; Re-capture properly:
        (when-let [[_ _local peer-addr]
                   (re-find #"(\S+)->(\S+)\s*\(ESTABLISHED\)" line)]
          (let [[peer-ip _peer-port] (str/split peer-addr #":")]
            {:local-port (try (Integer/parseInt (or local-port "0")) (catch Exception _ 0))
             :remote-ip  peer-ip
             :pid        (try (Long/parseLong (second parts)) (catch Exception _ nil))}))))))

(defn- connections-macos []
  (let [{:keys [exit out]} (sh "lsof" "-iTCP" "-nP" "-sTCP:ESTABLISHED")]
    (when (zero? exit)
      (keep parse-lsof-line (str/split-lines out)))))

(defn- live-connections []
  (case (os-type)
    :linux  (connections-linux)
    :macos  (connections-macos)
    nil))

;; ── Public API ────────────────────────────────────────────────────────────────

(def ^:private demo-sessions
  [{:id "s-01" :host "edge-fra-01"      :ip "185.12.44.21"  :user "deploy" :city "Frankfurt"   :country "DE" :region "EU-Central" :lat 50.1109  :lng   8.6821  :startedAt (- (System/currentTimeMillis) (* 1000 60 47))      :bytesIn 128441220   :bytesOut 4228110   :status "active" :cmd "tail -f /var/log/nginx/access.log"}
   {:id "s-02" :host "db-replica-tyo"   :ip "203.104.17.8"  :user "ops"    :city "Tokyo"       :country "JP" :region "APAC"       :lat 35.6762  :lng 139.6503  :startedAt (- (System/currentTimeMillis) (* 1000 60 12))      :bytesIn 12880001    :bytesOut 1120334   :status "active" :cmd "psql -U ops -d analytics"}
   {:id "s-03" :host "build-runner-4"   :ip "10.34.12.90"   :user "ci"     :city "Ashburn"     :country "US" :region "US-East"    :lat 39.0438  :lng -77.4874  :startedAt (- (System/currentTimeMillis) (* 1000 60 202))     :bytesIn 984221002   :bytesOut 44881210  :status "active" :cmd "docker build . -t app:edge"}
   {:id "s-04" :host "gpu-cluster-02"   :ip "172.19.8.55"   :user "rohan"  :city "Singapore"   :country "SG" :region "APAC"       :lat  1.3521  :lng 103.8198  :startedAt (- (System/currentTimeMillis) (* 1000 60 68))      :bytesIn 2410000000  :bytesOut 88440112  :status "active" :cmd "python train.py --epochs 40"}
   {:id "s-05" :host "monitor-sao"      :ip "177.42.9.14"   :user "sre"    :city "São Paulo"   :country "BR" :region "LATAM"      :lat -23.5505 :lng -46.6333  :startedAt (- (System/currentTimeMillis) (* 1000 60 4))       :bytesIn 2110234     :bytesOut 411090    :status "active" :cmd "htop"}
   {:id "s-06" :host "archive-store-syd":ip "45.12.118.2"   :user "deploy" :city "Sydney"      :country "AU" :region "APAC"       :lat -33.8688 :lng 151.2093  :startedAt (- (System/currentTimeMillis) (* 1000 60 33))      :bytesIn 55120901    :bytesOut 2004112   :status "active" :cmd "rsync -avz backup/ /mnt/cold"}
   {:id "s-07" :host "edge-lhr-02"      :ip "51.140.22.9"   :user "deploy" :city "London"      :country "GB" :region "EU-West"    :lat 51.5074  :lng  -0.1278  :startedAt (- (System/currentTimeMillis) (* 1000 60 341))     :bytesIn 781002110   :bytesOut 21334001  :status "idle"   :cmd "journalctl -f -u edge"}
   {:id "s-08" :host "analytics-pdx"   :ip "52.34.200.12"  :user "rohan"  :city "Portland"    :country "US" :region "US-West"    :lat 45.5152  :lng -122.6784 :startedAt (- (System/currentTimeMillis) (* 1000 60 19))      :bytesIn 410022100   :bytesOut 14880221  :status "active" :cmd "python -m analytics.run"}
   {:id "s-09" :host "bastion-cpt"      :ip "196.14.8.12"   :user "ops"    :city "Cape Town"   :country "ZA" :region "AFRICA"     :lat -33.9249 :lng  18.4241  :startedAt (- (System/currentTimeMillis) (* 1000 60 2))       :bytesIn 420112      :bytesOut 112004    :status "active" :cmd "ssh -J bastion app-01"}])

(defn get-sessions
  "Return current SSH sessions. If demo? is true, returns sample data."
  ([] (get-sessions false))
  ([demo?]
   (if demo?
     demo-sessions
     (let [conns    (or (live-connections) [])
           now      (System/currentTimeMillis)
           username (System/getProperty "user.name" "user")]
       (doall
         (keep
           (fn [{:keys [local-port remote-ip pid]}]
             (let [pinfo   (when pid (process-info pid))
                   geo     (geolocate remote-ip)
                   started (do
                             (swap! session-registry update local-port #(or % now))
                             (get @session-registry local-port))]
               (when geo
                 {:id        (str "s-" local-port)
                  :host      (resolve-hostname remote-ip)
                  :ip        remote-ip
                  :user      username
                  :city      (:city geo)
                  :country   (:country geo)
                  :region    (:region geo)
                  :lat       (:lat geo)
                  :lng       (:lng geo)
                  :startedAt (or (:started-at pinfo) started)
                  :bytesIn   0
                  :bytesOut  0
                  :status    "active"
                  :cmd       (or (:cmd pinfo) (str "ssh " remote-ip))})))
           conns))))))

(defn clear-registry!
  "Remove session registry entries for connections no longer active.
   Call periodically to avoid unbounded growth."
  []
  (let [active-ports (->> (or (live-connections) [])
                          (map :local-port)
                          set)]
    (swap! session-registry #(select-keys % active-ports))))
