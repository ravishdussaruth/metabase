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
  const [defaults, setDefaults] = useState<DefaultsMap | null>(null);

  useEffect(() => {
    if (databases.length && defaults === null) {
      setDefaults(
        new Map([
          ...databases.map<[number, DefaultMappings]>(
            db => [db.id, initialStrategyDefaults],
            ["root", initialStrategyDefaults],
          ),
        ]),
      );
    }
  }, [databases, defaults]);

  useEffect(
    function updateDefaults() {
      if (currentId === null || !currentStrategy) {
        return;
      }
      setDefaults((defaults: DefaultsMap | null) => {
        if (!defaults) {
          return defaults;
        }
        const type = currentStrategy.type;
        const mappings = defaults.get(currentId) as DefaultMappings;
        defaults.set(currentId, {
          ...mappings,
          [type]: { ...mappings?.[type], ...currentStrategy },
        });
        return defaults;
      });
    },
    [databases, currentStrategy, currentId, setDefaults],
  );
  return defaults;
};
