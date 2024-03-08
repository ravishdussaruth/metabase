(ns metabase-enterprise.caching.api
  (:require
   [compojure.core :refer [GET]]
   [metabase.api.common :as api]
   [metabase.api.common.validation :as validation]
   [metabase.api.routes.common :refer [+auth]]
   [metabase.events :as events]
   [metabase.util :as u]
   [metabase.util.cron :as u.cron]
   [metabase.util.i18n :refer [tru]]
   [metabase.util.malli.schema :as ms]
   [toucan2.core :as t2]))

(defn- assert-valid-models [model ids]
  (if (= model "root")
    (when-not (zero? (first ids))
      (throw (ex-info (tru "Root configuration is only valid with model_id = 0") {:status-code 400
                                                                                  :model_id    (first ids)})))
    (api/check-404 (t2/select-one (case model
                                    "database"  :model/Database
                                    "dashboard" :model/Dashboard
                                    "question"  :model/Card)
                                  :id [:in ids]))))

(defn- audit-caching-change! [id target prev new]
  (events/publish-event!
   :event/caching-update
   {:user-id api/*current-user-id*
    :model   :model/CacheConfig
    :details {:id             id
              :model          (:model target)
              :model_id       (:model_id target)
              :previous-value prev
              :next-value     new}}))

(api/defendpoint GET "/"
  "Return cache configuration."
  [:as {{:strs [model collection]
         :or   {model "root"}}
        :query-params}]
  {model      (ms/QueryVectorOf [:enum "root" "database" "dashboard" "question"])
   collection [:maybe ms/PositiveInt]}
  (validation/check-has-application-permission :setting)
  (let [items (t2/select :model/CacheConfig
                         :model [:in model]
                         {:left-join [:report_card      [:and
                                                         [:= :model [:inline "question"]]
                                                         [:= :model_id :report_card.id]
                                                         [:= :report_card.collection_id collection]]
                                      :report_dashboard [:and
                                                         [:= :model [:inline "dashboard"]]
                                                         [:= :model_id :report_dashboard.id]
                                                         [:= :report_dashboard.collection_id collection]]]
                          :where     [:case
                                      [:= :model [:inline "question"]]  [:!= :report_card.id nil]
                                      [:= :model [:inline "dashboard"]] [:!= :report_dashboard.id nil]
                                      :else                             true]})]
    {:items (for [item items]
              {:model    (:model item)
               :model_id (:model_id item)
               :strategy (assoc (:config item) :type (:strategy item))})}))

(api/defendpoint PUT "/"
  "Store cache configuration."
  [:as {{:keys [model model_id strategy]} :body}]
  {model    [:enum "root" "database" "dashboard" "question"]
   model_id ms/IntGreaterThanOrEqualToZero
   strategy [:and
             [:map
              [:type [:enum :nocache :ttl :duration :schedule :query]]]
             [:multi {:dispatch :type}
              [:nocache  [:map
                          [:type keyword?]]]
              [:ttl      [:map
                          [:type keyword?]
                          [:multiplier ms/PositiveInt]
                          [:min_duration ms/PositiveInt]]]
              [:duration [:map
                          [:type keyword?]
                          [:duration ms/PositiveInt]
                          [:unit [:enum "hours" "minutes" "seconds" "days"]]]]
              [:schedule [:map
                          [:type keyword?]
                          [:schedule u.cron/CronScheduleString]]]
              [:query    [:map
                          [:type keyword?]
                          [:field_id int?]
                          [:aggregation [:enum "max" "count"]]
                          [:schedule u.cron/CronScheduleString]]]]]}
  (validation/check-has-application-permission :setting)
  (assert-valid-models model [model_id])
  (t2/with-transaction [_tx]
    (let [criteria {:model    model
                    :model_id model_id}
          data     {:strategy (:type strategy)
                    :config   (dissoc strategy :type)}
          current  (t2/select-one :model/CacheConfig :model model :model_id model_id {:for :update})]
      {:id (u/prog1 (if current
                      (first (t2/update-returning-pks! :model/CacheConfig criteria data))
                      (t2/insert-returning-pk! :model/CacheConfig (merge criteria data)))
             (audit-caching-change! <> criteria current data))})))

; TODO: We no longer need to support deleting multiple model ids in one go
(api/defendpoint DELETE "/"
  [:as {{:keys [model model_id]} :body}]
  {model    [:enum "root" "database" "dashboard" "question"]
   model_id (ms/QueryVectorOf ms/PositiveInt)}
  (validation/check-has-application-permission :setting)
  (assert-valid-models model model_id)
  (let [current (t2/select :model/CacheConfig :model model :model_id [:in model_id])]
    (t2/delete! :model/CacheConfig :model model :model_id [:in model_id])
    (doseq [item current]
      (audit-caching-change! (:id item)
                             (select-keys item [:model :model_id])
                             (select-keys item [:strategy :config])
                             nil)))
  nil)

(api/define-routes +auth)
