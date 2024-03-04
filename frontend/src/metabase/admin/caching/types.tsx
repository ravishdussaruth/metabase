import { t } from "ttag";
import type { AnySchema } from "yup";

import {
  doNotCacheStrategyValidationSchema,
  durationStrategyValidationSchema,
  strategyValidationSchema,
  //queryStrategyValidationSchema,
  //scheduleStrategyValidationSchema,
  ttlStrategyValidationSchema,
} from "./validation";

type StrategyData = {
  label: string;
  validateWith: AnySchema;
};

export type StrategyType = "nocache" | "ttl" | "duration";
// | "schedule"
// | "query";

/** Cache invalidation strategies and related metadata */
export const Strategies: Record<StrategyType, StrategyData> = {
  nocache: {
    label: t`Don't cache`,
    validateWith: doNotCacheStrategyValidationSchema,
  },
  ttl: {
    label: t`When the TTL expires`,
    validateWith: ttlStrategyValidationSchema,
  },
  duration: {
    label: t`On a regular duration`,
    validateWith: durationStrategyValidationSchema,
  },
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

/** Cache invalidation strategy */
export type Strategy = DoNotCacheStrategy | TTLStrategy | DurationStrategy;
// | ScheduleStrategy
// | QueryStrategy;

/** Cache invalidation configuration */
export interface Config {
  /** The type of cacheable object this configuration concerns */
  model: Model;
  model_id: number;
  /** Cache invalidation strategy */
  strategy: Strategy;
}

export type DBStrategySetter = (
  databaseId: number,
  newStrategy: Strategy | null,
) => void;

export type RootStrategySetter = (newStrategy: Strategy | null) => void;

export const isValidStrategy = (x: unknown): x is Strategy => {
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

export type DefaultMappings = {
  nocache: Partial<DoNotCacheStrategy>;
  ttl: Partial<TTLStrategy>;
  duration: Partial<DurationStrategy>;
  // schedule: Partial<ScheduleStrategy>;
  // query: Partial<QueryStrategy>;
};

export type DefaultsMap = Map<number | "root", DefaultMappings>;

export const initialStrategyDefaults: DefaultMappings = {
  ttl: {
    min_duration: 1,
    multiplier: 1,
  },
  duration: {
    duration: 1,
    unit: "hours",
  },
  nocache: {},
  // schedule: {
  //   schedule: "* * * * *",
  // },
  // query: {
  //   field_id: 1,
  //   aggregation: "max",
  //   schedule: "* * * * *",
  // },
  // TODO: Use better defaults
};

export const rootConfigLabel = t`Default for all databases`;
