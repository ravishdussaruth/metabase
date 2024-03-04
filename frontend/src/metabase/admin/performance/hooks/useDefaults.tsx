import { useEffect, useState } from "react";

import type Database from "metabase-lib/metadata/Database";

import type {
  DoNotCacheStrategy,
  DurationStrategy,
  Strategy,
  TTLStrategy,
} from "../types";

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

export const useStrategyDefaults = (
  databases: Database[],
  currentId: "root" | number | null,
  currentStrategy: Strategy | null | undefined,
) => {
  const [defaults, setDefaults] = useState<DefaultsMap>(
    () =>
      new Map(
        databases.map<[number, DefaultMappings]>(db => [
          db.id,
          initialStrategyDefaults,
        ]),
      ),
  );

  if (!defaults.has("root")) {
    defaults.set("root", initialStrategyDefaults);
  }

  useEffect(
    function updateDefaults() {
      if (currentId === null || !currentStrategy) {
        return;
      }
      setDefaults((defaults: DefaultsMap) => {
        const type = currentStrategy.type;
        const mappings = defaults.get(currentId) as DefaultMappings;
        defaults.set(currentId, {
          ...mappings,
          [type]: { ...mappings?.[type], ...currentStrategy },
        });
        return defaults;
      });
    },
    [currentStrategy, currentId, setDefaults],
  );

  return defaults;
};
