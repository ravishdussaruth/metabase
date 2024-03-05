import { useEffect, useState } from "react";

import type Database from "metabase-lib/metadata/Database";

import type {
  Config,
  DoNotCacheStrategy,
  DurationStrategy,
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

/** Helps set default values in the strategy editor form */
export const useStrategyDefaults = (
  databases?: Database[],
  targetConfig?: Config,
) => {
  const [defaults, setDefaults] = useState<DefaultsMap | null>(null);
  const { model_id: targetId, strategy: currentStrategy } = targetConfig || {};

  useEffect(() => {
    if (databases?.length && defaults === null) {
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
    /** Update defaults when the target's strategy changes */
    function updateDefaults() {
      if (targetId === undefined || !currentStrategy) {
        return;
      }
      setDefaults((defaults: DefaultsMap | null) => {
        if (!defaults) {
          return defaults;
        }
        const type = currentStrategy.type;
        const mappings = defaults.get(targetId) as DefaultMappings;
        defaults.set(targetId, {
          ...mappings,
          [type]: { ...mappings?.[type], ...currentStrategy },
        });
        return defaults;
      });
    },
    [currentStrategy, targetId, databases, setDefaults],
  );
  return defaults;
};
