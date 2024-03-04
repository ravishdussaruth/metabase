import { t } from "ttag";
import type { AnySchema } from "yup";

import {
  durationStrategyValidationSchema,
  //queryStrategyValidationSchema,
  //scheduleStrategyValidationSchema,
  ttlStrategyValidationSchema,
  unitOfTimeRegex,
} from "./validation";

type StrategyData = {
  label: string;
  validateWith?: AnySchema;
};

export type StrategyType = "nocache" | "ttl" | "duration";
// | "schedule"
// | "query";

/** Cache invalidation strategies and related metadata */
export const Strategies: Record<StrategyType, StrategyData> = {
  nocache: { label: t`Don't cache` },
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

export type UnitOfTime = "hours" | "minutes" | "seconds" | "days";

const isValidUnitOfTime = (x: unknown): x is UnitOfTime =>
  typeof x === "string" && unitOfTimeRegex.test(x);

export type GetConfigByModelId = Map<number | "root" | null, Config>;

export type Model =
  | "root"
  | "database"
  | "collection"
  | "dashboard"
  | "question";

const isValidModel = (x: unknown): x is Model =>
  typeof x === "string" &&
  ["root", "database", "collection", "dashboard", "question"].includes(x);

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

// TODO:  Either remove this validation or perhaps use Yup
export const isValidStrategy = (x: unknown): x is Strategy => {
  if (!hasType(x)) {
    return false;
  }
  const keyCount = Object.keys(x).length;
  if (x.type === "nocache") {
    return keyCount === 1;
  }
  if (x.type === "ttl") {
    return (
      keyCount === 3 &&
      typeof x.min_duration === "number" &&
      typeof x.multiplier === "number"
    );
  }
  if (x.type === "duration") {
    return (
      keyCount === 3 &&
      typeof x.duration === "number" &&
      isValidUnitOfTime(x.unit)
    );
  }
  // if (x.type === "schedule") {
  //   return (
  //     keyCount === 2 && x.type === "schedule" && typeof x.schedule === "string"
  //   );
  // }
  // if (x.type === "query") {
  //   return (
  //     keyCount === 4 &&
  //     typeof x.field_id === "number" &&
  //     ["max", "count"].includes(x.aggregation) &&
  //     typeof x.schedule === "string"
  //   );
  // }
  return false;
};

type NonNullObject = {
  [key: string]: any;
};

const isValidObject = (x: unknown): x is NonNullObject => {
  if (typeof x !== "object") {
    return false;
  }
  if (x === null) {
    return false;
  }
  return true;
};

const hasType = (x: unknown): x is NonNullObject & { type: any } =>
  isValidObject(x) && "type" in x;
const hasValidModel = (x: unknown): x is NonNullObject & { model: Model } =>
  isValidObject(x) && "model" in x && isValidModel(x.model);
const hasValidModelId = (
  x: unknown,
): x is NonNullObject & { model_id: number } =>
  isValidObject(x) && "model_id" in x && typeof x.model_id === "number";
const hasValidStrategy = (
  x: unknown,
): x is NonNullObject & { strategy: Strategy } =>
  isValidObject(x) && "strategy" in x && isValidStrategy(x.strategy);
export const isValidConfig = (x: unknown): x is Config =>
  hasValidModel(x) && hasValidModelId(x) && hasValidStrategy(x);

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
