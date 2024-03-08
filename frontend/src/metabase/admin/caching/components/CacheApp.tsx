import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAsync } from "react-use";
import { t } from "ttag";

import { useDatabaseListQuery } from "metabase/common/hooks";
import LoadingAndErrorWrapper from "metabase/components/LoadingAndErrorWrapper";
import { CacheConfigApi } from "metabase/services";
import { Tabs } from "metabase/ui";

import {
  isValidConfig,
  isValidStrategy,
  isValidTabId,
  TabId,
  type Config,
  type GetConfigByModelId,
  type Strategy,
  type StrategySetter,
} from "../types";

import { Tab, TabContentWrapper, TabsList, TabsPanel } from "./CacheApp.styled";
import { DatabaseStrategyEditor } from "./DatabaseStrategyEditor";
const defaultRootStrategy: Strategy = { type: "nocache" };

class Serially {
  private queue: (() => Promise<any>)[] = [];
  private lastPromise: Promise<any> = Promise.resolve();
  public do = (promise: Promise<any>) => {
    this.lastPromise = this.lastPromise
      .then(() => promise)
      .catch(() => promise)
      .finally(() => {
        this.queue.shift();
        this.queue[0]?.();
      });
    this.queue.push(() => this.lastPromise);
  };
}
const serially = new Serially();

export const CacheApp = () => {
  const [tabId, setTabId] = useState<TabId>(TabId.DataCachingSettings);
  const [tabsHeight, setTabsHeight] = useState<number>(300);
  const tabsRef = useRef<HTMLDivElement>(null);

  const {
    data: databases = [],
    error: errorWhenLoadingDatabases,
    isLoading: areDatabasesLoading,
  } = useDatabaseListQuery();

  const {
    value: configsFromAPI,
    loading: areConfigsLoading,
    error: errorWhenLoadingConfigs,
  }: {
    value?: unknown[];
    loading: boolean;
    error?: any;
  } = useAsync(async () => {
    const [rootConfigsFromAPI, dbConfigsFromAPI] = await Promise.all([
      CacheConfigApi.list({ model: "root" }),
      CacheConfigApi.list({ model: "database" }),
    ]);
    const configs = [
      ...(rootConfigsFromAPI?.items ?? []),
      ...(dbConfigsFromAPI?.items ?? []),
    ];
    return configs;
  }, []);

  const [configs, setConfigs] = useState<Config[]>([]);

  useEffect(() => {
    // TODO: Remove validation?
    if (configsFromAPI) {
      const validConfigs = configsFromAPI.reduce<Config[]>(
        (acc, configFromAPI: unknown) => {
          if (isValidConfig(configFromAPI)) {
            return [...acc, configFromAPI];
          } else {
            console.error(
              `Invalid config retrieved from API: ${JSON.stringify(
                configFromAPI,
              )}`,
            );
            return acc;
          }
        },
        [],
      );
      setConfigs(validConfigs);
    }
  }, [configsFromAPI]);

  const dbConfigs: GetConfigByModelId = useMemo(() => {
    const map: GetConfigByModelId = new Map();
    configs.forEach(config => {
      if (config.model === "database") {
        map.set(config.model_id, config);
      } else if (config.model === "root") {
        map.set("root", config);
      }
    });
    if (!map.has("root")) {
      map.set("root", {
        model: "root",
        model_id: 0,
        strategy: defaultRootStrategy,
      });
    }
    return map;
  }, [configs]);

  const setStrategy = useCallback<StrategySetter>(
    async (model, model_id, newStrategy) => {
      const baseConfig: Pick<Config, "model" | "model_id"> = {
        model,
        model_id,
      };
      const otherConfigs = configs.filter(
        config => config.model_id !== model_id,
      );
      if (newStrategy) {
        if (!isValidStrategy(newStrategy)) {
          throw new Error(`Invalid strategy: ${JSON.stringify(newStrategy)}`);
        }
        const newConfig: Config = {
          ...baseConfig,
          strategy: newStrategy,
        };
        if (!isValidConfig(newConfig)) {
          throw new Error(`Invalid cache config: ${JSON.stringify(newConfig)}`);
        }
        setConfigs([...otherConfigs, newConfig]);
        // TODO: What if the update fails? This might be over-engineering, but
        // maybe: always cache the previous state so we can roll back, and show
        // an error toast?
        serially.do(CacheConfigApi.update(newConfig));
      } else {
        setConfigs(otherConfigs);
        serially.do(CacheConfigApi.delete(baseConfig));
      }
    },
    [configs],
  );

  const clearDBOverrides = useCallback(() => {
    setConfigs(configs => configs.filter(({ model }) => model !== "database"));
  }, []);

  useLayoutEffect(() => {
    const handleResize = () => {
      const tabs = tabsRef.current;
      if (!tabs) {
        return;
      }
      const tabsElementTop = tabs.getBoundingClientRect().top;
      const newHeight = window.innerHeight - tabsElementTop - tabs.clientTop;
      setTabsHeight(newHeight);
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    setTimeout(handleResize, 50);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [tabsRef, areDatabasesLoading, areConfigsLoading, areConfigsLoading]);

  if (errorWhenLoadingConfigs || areConfigsLoading) {
    return (
      <LoadingAndErrorWrapper
        error={errorWhenLoadingConfigs}
        loading={areConfigsLoading}
      />
    );
  }

  if (errorWhenLoadingDatabases || areDatabasesLoading) {
    return (
      <LoadingAndErrorWrapper
        error={errorWhenLoadingDatabases}
        loading={areDatabasesLoading}
      />
    );
  }

  // TODO: The horizontal row of tabs does not look so good in narrow viewports
  return (
    <Tabs
      value={tabId}
      onTabChange={value => {
        if (isValidTabId(value)) {
          setTabId(value);
          // perhaps later use: dispatch(push(`/admin/caching/${value}`));
          // or history.pushState to avoid reloading too much?
        } else {
          console.error("Invalid tab value", value);
        }
      }}
      style={{ display: "flex", flexDirection: "column" }}
      ref={tabsRef}
      bg="bg-light"
      h={tabsHeight}
    >
      <TabsList>
        <Tab key={"DataCachingSettings"} value={TabId.DataCachingSettings}>
          {t`Data caching settings`}
        </Tab>
      </TabsList>
      <TabsPanel key={tabId} value={tabId}>
        <TabContentWrapper>
          <DatabaseStrategyEditor
            databases={databases}
            dbConfigs={dbConfigs}
            setRootStrategy={strategy => setStrategy("root", 0, strategy)}
            setDBStrategy={(databaseId, strategy) =>
              setStrategy("database", databaseId, strategy)
            }
            clearDBOverrides={clearDBOverrides}
          />
        </TabContentWrapper>
      </TabsPanel>
    </Tabs>
  );
};
