import { c, t } from "ttag";
import type { AnySchema } from "yup";

import type { IconName } from "metabase/ui";

import {
  strategyValidationSchema,
  doNotCacheStrategyValidationSchema,
  ttlStrategyValidationSchema,
  durationStrategyValidationSchema,
  inheritStrategyValidationSchema,
  //queryStrategyValidationSchema,
  //scheduleStrategyValidationSchema,
} from "./validation";

type StrategyData = {
  label: string;
  shortLabel?: string;
  validateWith: AnySchema;
  iconName?: IconName;
};

export type StrategyType = "nocache" | "ttl" | "duration" | "inherit";
// | "schedule"
// | "query";

/** Cache invalidation strategies and related metadata */
export const Strategies: Record<StrategyType, StrategyData> = {
  nocache: {
    label: t`Don't cache results`,
    validateWith: doNotCacheStrategyValidationSchema,
  },
  ttl: {
    label: t`When the time-to-live (TTL) expires`,
    shortLabel: c("'TTL' is short for 'time-to-live'").t`TTL expiration`,
    validateWith: ttlStrategyValidationSchema,
    iconName: "clock",
  },
  duration: {
    label: t`After a specific number of hours`,
    validateWith: durationStrategyValidationSchema,
  },
  inherit: { label: t`Inherit`, validateWith: inheritStrategyValidationSchema },
  // TODO: Add these in later
  // schedule: {
  //   label: t`On a schedule`,
  //   validateWith: scheduleStrategyValidationSchema,
  // },
  // query: {
  //   label: t`When the data updates`,
  //   validateWith: queryStrategyValidationSchema,
  // },
};

export const getStrategyLabel = (strategy?: Strat) => {
  return strategy ? Strategies[strategy.type].label : null;
};

export const getShortStrategyLabel = (strategy?: Strat) => {
  if (!strategy) {
    return null;
  }
  const type = Strategies[strategy.type];
  return type.shortLabel ?? type.label;
};

export const isValidStrategyName = (
  strategy: string,
): strategy is StrategyType => {
  return Object.keys(Strategies).includes(strategy);
};

export type GetConfigByModelId = Map<number | "root" | null, Config>;

export type Model =
  | "root"
  | "database"
  | "collection"
  | "dashboard"
  | "question";

interface StrategyBase {
  type: StrategyType;
}

export interface TTLStrategy extends StrategyBase {
  type: "ttl";
  multiplier: number;
  min_duration: number;
}

export interface DoNotCacheStrategy extends StrategyBase {
  type: "nocache";
}

export interface DurationStrategy extends StrategyBase {
  type: "duration";
  duration: number;
  unit: "hours" | "minutes" | "seconds" | "days";
}

export interface InheritStrategy extends StrategyBase {
  type: "inherit";
}

// TODO: Add these in later
// export interface ScheduleStrategy extends StrategyBase {
//   type: "schedule";
//   schedule: string;
// }

// export interface QueryStrategy extends StrategyBase {
//   type: "query";
//   field_id: number;
//   aggregation: "max" | "count";
//   schedule: string;
// }

// TODO: rename to Strategy
/** Cache invalidation strategy */
export type Strat =
  | DoNotCacheStrategy
  | TTLStrategy
  | DurationStrategy
  | InheritStrategy;
// | ScheduleStrategy
// | QueryStrategy;

/** Cache invalidation configuration */
export interface Config {
  /** The type of cacheable object this configuration concerns */
  model: Model;
  model_id: number;
  /** Cache invalidation strategy */
  strategy: Strat;
}

export type DBStrategySetter = (
  databaseId: number,
  newStrategy: Strat | null,
) => void;

export type RootStrategySetter = (newStrategy: Strat | null) => void;

export const isValidStrategy = (x: unknown): x is Strat => {
  return strategyValidationSchema.validateSync(x);
};

export enum TabId {
  DataCachingSettings = "dataCachingSettings",
  DashboardAndQuestionCaching = "dashboardAndQuestionCaching",
  ModelPersistence = "modelPersistence",
  CachingStats = "cachingStats",
}
export const isValidTabId = (tab: unknown): tab is TabId =>
  typeof tab === "string" && Object.values(TabId).map(String).includes(tab);

export type ObjectWithType = {
  type: string;
  [key: string]: string;
};

export const rootConfigLabel = t`Default for all databases`;
