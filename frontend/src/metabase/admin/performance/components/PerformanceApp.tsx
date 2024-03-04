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
import _ from "underscore";

import { useDatabaseListQuery } from "metabase/common/hooks";
import LoadingAndErrorWrapper from "metabase/components/LoadingAndErrorWrapper";
import { color } from "metabase/lib/colors";
import { useDispatch } from "metabase/lib/redux";
import { addUndo } from "metabase/redux/undo";
import { CacheConfigApi } from "metabase/services";
import { Flex, Tabs } from "metabase/ui";

import type { Config, GetConfigByModelId, Model, Strategy } from "../types";
import { isValidTabId, TabId } from "../types";

import { DatabaseStrategyEditor } from "./DatabaseStrategyEditor";
import { Tab, TabsList, TabsPanel } from "./PerformanceApp.styled";

const defaultRootStrategy: Strategy = { type: "nocache" };

export const PerformanceApp = () => {
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

  const dispatch = useDispatch();

  const showSuccessToast = useCallback(async () => {
    dispatch(
      addUndo({
        message: "Updated",
        toastColor: "success",
        dismissButtonColor: color("white"),
      }),
    );
  }, [dispatch]);

  const showErrorToast = useCallback(async () => {
    dispatch(
      addUndo({
        icon: "warning",
        message: "Error",
        toastColor: "error",
        dismissButtonColor: color("white"),
      }),
    );
  }, [dispatch]);

  useEffect(() => {
    if (configsFromAPI) {
      setConfigs(configsFromAPI as Config[]);
    }
  }, [configsFromAPI]);

  const dbConfigs: GetConfigByModelId = useMemo(() => {
    const map: GetConfigByModelId = new Map();
    configs.forEach(config => {
      map.set(config.model === "database" ? config.model_id : "root", config);
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedRequest = useCallback(
    _.debounce(
      (
        requestFunction: (
          arg: any,
          options: { fetch?: boolean },
        ) => Promise<any>,
        arg: any,
        options: { fetch?: boolean; [key: string]: any },
        onSuccess: () => Promise<any>,
        onError: () => Promise<any>,
      ) => {
        options.fetch ??= true;
        return requestFunction(arg, options).then(onSuccess).catch(onError);
      },
      // TODO: Perhaps increase the debounce wait time when user is
      // using arrow keys to change the strategy type
      200,
    ),
    [],
  );

  const setStrategy = useCallback(
    async (model: Model, model_id: number, newStrategy: Strategy | null) => {
      const baseConfig: Pick<Config, "model" | "model_id"> = {
        model,
        model_id,
      };
      const otherConfigs = configs.filter(
        config => config.model_id !== model_id,
      );

      const oldConfig = dbConfigs.get(model_id);
      const onSuccess = async () => {
        await showSuccessToast(itemName);
      };
      const onError = async () => {
        await showErrorToast(itemName);
        // Revert to earlier state
        setConfigs(oldConfig ? [...otherConfigs, oldConfig] : otherConfigs);
        // FIXME: this reverts to an earlier state even if the user has already
        // changed the value again. We should revert only if there is no newer
        // change
      };

      if (newStrategy) {
        const newConfig: Config = {
          ...baseConfig,
          strategy: newStrategy,
        };
        setConfigs([...otherConfigs, newConfig]);
        debouncedRequest(
          CacheConfigApi.update,
          newConfig,
          {},
          onSuccess,
          onError,
        );
      } else {
        setConfigs(otherConfigs);
        debouncedRequest(
          CacheConfigApi.delete,
          baseConfig,
          { hasBody: true },
          onSuccess,
          onError,
        );
      }
    },
    [configs, dbConfigs, debouncedRequest, showErrorToast, showSuccessToast],
  );

  const clearDBOverrides = useCallback(() => {
    setConfigs(configs => configs.filter(({ model }) => model !== "database"));

    configs
      .filter(({ model }) => model === "database")
      .forEach(config => {
        if (config.model !== "database") {
          return;
        }
        const onSuccess = async () => {
          await showSuccessToast();
        };
        const onError = async () => {
          await showErrorToast();
          // TODO: Revert to earlier state?
        };
        debouncedRequest(
          CacheConfigApi.delete,
          config,
          { hasBody: true },
          onSuccess,
          onError,
        );
      });
  }, [configs, debouncedRequest, showErrorToast, showSuccessToast]);

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

  const [showLoadingSpinner, setShowLoadingSpinner] = useState(false);

  useEffect(
    /**
     * @see https://metaboat.slack.com/archives/C02H619CJ8K/p1709558533499399
     */
    function delayLoadingSpinner() {
      setTimeout(() => {
        setShowLoadingSpinner(true);
      }, 300);
    },
    [],
  );

  if (errorWhenLoadingConfigs || areConfigsLoading) {
    return showLoadingSpinner ? (
      <LoadingAndErrorWrapper
        error={errorWhenLoadingConfigs}
        loading={areConfigsLoading}
      />
    ) : null;
  }

  if (errorWhenLoadingDatabases || areDatabasesLoading) {
    return showLoadingSpinner ? (
      <LoadingAndErrorWrapper
        error={errorWhenLoadingDatabases}
        loading={areDatabasesLoading}
      />
    ) : null;
  }

  // TODO: The horizontal row of tabs does not look so good in narrow viewports
  return (
    <Tabs
      value={tabId}
      onTabChange={value => {
        if (isValidTabId(value)) {
          setTabId(value);
          // perhaps later use: dispatch(push(`/admin/performance/${value}`));
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
      <TabsPanel
        key={tabId}
        value={tabId}
        h="calc(100% - 41px)"
        p="1rem 2.5rem"
      >
        <Flex style={{ flex: 1 }} bg="bg-light" h="100%">
          <DatabaseStrategyEditor
            databases={databases}
            dbConfigs={dbConfigs}
            setRootStrategy={strategy => setStrategy("root", 0, strategy)}
            setDBStrategy={(databaseId, strategy) =>
              setStrategy("database", databaseId, strategy)
            }
            clearDBOverrides={clearDBOverrides}
          />
        </Flex>
      </TabsPanel>
    </Tabs>
  );
};
