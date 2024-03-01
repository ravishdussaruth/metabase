import { t } from "ttag";

type StrategyTypeData = {
  label: string;
};

export type StrategyName =
  | "nocache"
  | "ttl"
  | "duration"
  | "schedule"
  | "query";

export const Strategies: Record<StrategyName, StrategyTypeData> = {
  nocache: { label: t`Don't cache` },
  ttl: {
    label: t`When the TTL expires`,
  },
  duration: { label: t`On a regular duration` },
  schedule: { label: t`On a schedule` },
  query: {
    label: t`When the data updates`,
  },
};

export const isValidStrategyName = (
  strategy: string,
): strategy is StrategyName => {
  return Object.keys(Strategies).includes(strategy);
};

export type UnitOfTime = "hours" | "minutes" | "seconds" | "days";

const isValidUnitOfTime = (x: unknown): x is UnitOfTime =>
  typeof x === "string" && ["hours", "minutes", "seconds", "days"].includes(x);

export type GetConfigByModelId = Map<number, Config>;

export type Model =
  | "root"
  | "database"
  | "collection"
  | "dashboard"
  | "question";

const isValidModel = (x: unknown): x is Model =>
  typeof x === "string" &&
  ["root", "database", "collection", "dashboard", "question"].includes(x);

type NoExtraProperties<T> = {
  [P in keyof T]: T[P];
} & {
  [P: string]: never;
};

interface StrategyBase {
  type: StrategyName;
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

export interface ScheduleStrategy extends StrategyBase {
  type: "schedule";
  schedule: string;
}

export interface QueryStrategy extends StrategyBase {
  type: "query";
  field_id: number;
  aggregation: "max" | "count";
  schedule: string;
}

type ExtendableStrategy =
  | DoNotCacheStrategy
  | TTLStrategy
  | DurationStrategy
  | ScheduleStrategy
  | QueryStrategy;

/** Cache invalidation strategy */
export type Strategy = NoExtraProperties<ExtendableStrategy>;

/** Cache invalidation configuration */
export interface Config {
  /** The type of cacheable object this configuration concerns */
  model: Model;
  model_id: number;
  /** Cache invalidation strategy */
  strategy: Strategy;
}

// This currently has a different shape than CacheConfig
export interface CacheConfigFromAPI {
  model: Model;
  model_id: number;
  strategy: StrategyName;
  config: Omit<Strategy, "type">;
}

export type StrategySetter = (
  model: Model,
  modelId: number,
  newStrategy: Strategy | null,
) => void;

export type DBStrategySetter = (
  databaseId: number,
  newStrategy: Strategy | null,
) => void;

export type RootStrategySetter = (newStrategy: Strategy | null) => void;

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
      keyCount === 2 &&
      typeof x.duration === "number" &&
      isValidUnitOfTime(x.unit)
    );
  }
  if (x.type === "schedule") {
    return (
      keyCount === 2 && x.type === "schedule" && typeof x.schedule === "string"
    );
  }
  if (x.type === "query") {
    return (
      keyCount === 3 &&
      typeof x.field_id === "number" &&
      ["max", "count"].includes(x.aggregation) &&
      typeof x.schedule === "string"
    );
  }
  return false;
};

type NonNullObject = {
  [key: string]: any;
};

type StrategyFromAPI = {
  strategy: Strategy;
  config: any;
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

export const isValidConfigFromAPI = (x: unknown): x is StrategyFromAPI => {
  if (!isValidObject(x)) {
    return false;
  }
  return "strategy" in x && "config" in x;
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
