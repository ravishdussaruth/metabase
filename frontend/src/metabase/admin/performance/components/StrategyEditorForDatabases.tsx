import type { Dispatch, MouseEvent, SetStateAction } from "react";
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
import { color } from "metabase/lib/colors";
import { CacheConfigApi } from "metabase/services";
import {
  Button,
  Flex,
  Grid,
  Icon,
  Radio,
  Stack,
  Text,
  Title,
} from "metabase/ui";
import type Database from "metabase-lib/metadata/Database";

import { useStrategyDefaults } from "../hooks/useDefaults";
import { useRequests } from "../hooks/useRequests";
import type {
  Config,
  DurationStrategy,
  GetConfigByModelId,
  Model,
  Strategy,
  StrategyType,
  TTLStrategy,
} from "../types";
import { isValidStrategy, rootConfigLabel, Strategies } from "../types";
import {
  durationStrategyValidationSchema,
  ttlStrategyValidationSchema,
} from "../validation";

import {
  ConfigureSelectedStrategy,
  PositiveNumberInput,
} from "./ConfigureSelectedStrategy";
import {
  Chip,
  ConfigButton,
  Panel,
  TabWrapper,
} from "./StrategyEditorForDatabases.styled";

const defaultRootStrategy: Strategy = { type: "nocache" };

export const StrategyEditorForDatabases = ({
  tabsRef,
  setTabsHeight,
}: {
  tabsRef: React.RefObject<HTMLDivElement>;
  setTabsHeight: (height: number) => void;
}) => {
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
    value?: Config[];
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
    if (configsFromAPI) {
      setConfigs(configsFromAPI);
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

  /** Id of the database currently being edited, or 'root' for the root strategy */
  const [targetId, setTargetId] = useState<number | "root" | null>(null);
  const rootStrategy = dbConfigs.get("root")?.strategy;
  const rootStrategyLabel = rootStrategy
    ? Strategies[rootStrategy?.type]?.label
    : null;
  const targetConfig = dbConfigs.get(targetId);
  const currentDatabase = databases.find(db => db.id === targetId);
  const currentStrategy = targetConfig?.strategy;

  const defaults = useStrategyDefaults(databases, targetConfig);

  const { debouncedRequest, showSuccessToast, showErrorToast } = useRequests();

  const setStrategy = useCallback(
    (model: Model, model_id: number, newStrategy: Strategy | null) => {
      const baseConfig: Pick<Config, "model" | "model_id"> = {
        model,
        model_id,
      };
      const otherConfigs = configs.filter(
        config => config.model_id !== model_id,
      );

      const configBeforeChange = dbConfigs.get(model_id);
      const onSuccess = async () => {
        await showSuccessToast();
      };
      const onError = async () => {
        await showErrorToast();
        // Revert to earlier state
        setConfigs(
          configBeforeChange
            ? [...otherConfigs, configBeforeChange]
            : otherConfigs,
        );
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

  const setRootStrategy = (newStrategy: Strategy) =>
    setStrategy("root", 0, newStrategy);
  const setDBStrategy = (databaseId: number, newStrategy: Strategy | null) =>
    setStrategy("database", databaseId, newStrategy);
  const deleteDBStrategy = (databaseId: number) =>
    setDBStrategy(databaseId, null);

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

  const [showLoadingSpinner, setShowLoadingSpinner] = useState(false);

  // TODO: If this doesn't need to depend on areDatabasesLoading etc then move it up
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
  }, [
    tabsRef,
    setTabsHeight,
    areDatabasesLoading,
    areConfigsLoading,
    areConfigsLoading,
  ]);

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

  const updateStrategy = (newStrategyValues: Partial<Strategy> | null) => {
    const strategyType: StrategyType | undefined =
      newStrategyValues?.type ?? currentStrategy?.type;
    const relevantDefaults =
      targetId && strategyType ? defaults?.get(targetId)?.[strategyType] : null;
    const newStrategy = {
      ...relevantDefaults,
      ...newStrategyValues,
    };
    if (!isValidStrategy(newStrategy)) {
      console.error(`Invalid strategy: ${JSON.stringify(newStrategy)}`);
      return;
    }
    if (targetId === "root") {
      setRootStrategy(newStrategy);
    } else if (targetId !== null) {
      setDBStrategy(targetId, newStrategy);
    } else {
      console.error("No target specified");
    }
  };

  const showEditor = targetId !== null;

  const handleFormSubmit = (values: Partial<Strategy>) => {
    updateStrategy({ ...currentStrategy, ...values });
  };

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

  return (
    <TabWrapper role="region" aria-label="Data caching settings">
      <Text component="aside" lh="1rem" maw="32rem" mb="1.5rem">
        {t`Cache the results of queries to have them display instantly. Here you can choose when cached results should be invalidated. You can set up one rule for all your databases, or apply more specific settings to each database.`}
      </Text>
      <Grid
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          overflow: "hidden",
        }}
        w="100%"
        mb="1rem"
        role="form"
      >
        <Panel role="group" style={{ backgroundColor: color("bg-light") }}>
          <ConfigButton
            onClick={() => {
              setTargetId("root");
            }}
            variant={targetId === "root" ? "filled" : "white"}
            p="1rem"
            miw="20rem"
            fw="bold"
          >
            <Flex gap="0.5rem">
              <Icon name="database" />
              {t`Databases`}
            </Flex>
            <Chip
              p="0.75rem 1rem"
              variant={targetId !== "root" ? "filled" : "white"}
            >
              {rootStrategyLabel}
            </Chip>
          </ConfigButton>
        </Panel>
        <Panel role="group">
          {databases.map(db => (
            <TargetSwitcher
              db={db}
              key={db.id.toString()}
              dbConfigs={dbConfigs}
              deleteDBStrategy={deleteDBStrategy}
              targetId={targetId}
              setTargetId={setTargetId}
            />
          ))}
          <Button
            onClick={() => {
              clearDBOverrides();
            }}
            disabled={dbConfigs.size === 1}
            style={{
              border: "none",
              color:
                dbConfigs.size === 1 ? color("text-light") : color("error"),
              backgroundColor: "transparent",
            }}
            mt="auto"
            ml="auto"
          >{t`Clear all overrides`}</Button>
        </Panel>
        <Panel role="group">
          {showEditor && (
            <Stack spacing="xl">
              <StrategySelector
                targetId={targetId}
                currentDatabase={currentDatabase}
                currentStrategy={currentStrategy}
                rootStrategy={rootStrategy}
                updateStrategy={updateStrategy}
              />
              {currentStrategy?.type === "ttl" && (
                <ConfigureSelectedStrategy<TTLStrategy>
                  updateStrategy={updateStrategy}
                  currentStrategy={currentStrategy}
                  validationSchema={ttlStrategyValidationSchema}
                >
                  <section>
                    <Title order={3}>{t`Minimum query duration`}</Title>
                    <p>
                      {t`Metabase will cache all saved questions with an average query execution time longer than this many seconds:`}
                    </p>
                    <PositiveNumberInput
                      fieldName="min_duration"
                      handleSubmit={handleFormSubmit}
                    />
                  </section>
                  <section>
                    <Title
                      order={3}
                    >{t`Cache time-to-live (TTL) multiplier`}</Title>
                    <p>
                      {t`To determine how long each saved question's cached result should stick around, we take the query's average execution time and multiply that by whatever you input here. So if a query takes on average 2 minutes to run, and you input 10 for your multiplier, its cache entry will persist for 20 minutes.`}
                    </p>
                    <PositiveNumberInput
                      fieldName="multiplier"
                      handleSubmit={handleFormSubmit}
                    />
                  </section>
                </ConfigureSelectedStrategy>
              )}
              {currentStrategy?.type === "duration" && (
                <ConfigureSelectedStrategy<DurationStrategy>
                  updateStrategy={updateStrategy}
                  currentStrategy={currentStrategy}
                  validationSchema={durationStrategyValidationSchema}
                >
                  <section>
                    <Title order={3}>{t`Duration`}</Title>
                    <p>{t`(explanation goes here)`}</p>
                    <PositiveNumberInput
                      fieldName="duration"
                      handleSubmit={handleFormSubmit}
                    />
                  </section>
                </ConfigureSelectedStrategy>
              )}
              {/*
              {currentStrategy?.type === "schedule" && (
                <ConfigureSelectedStrategy<ScheduleStrategy>
                  updateStrategy={updateStrategy}
                  currentStrategy={currentStrategy}
                  validationSchema={scheduleStrategyValidationSchema}
                >
                  <section>
                    <Title order={3}>{t`Schedule`}</Title>
                    <p>{t`(explanation goes here)`}</p>
                    <CronInput
                      initialValue={currentStrategy.schedule}
                      handleSubmit={handleFormSubmit}
                    />
                  </section>
                </ConfigureSelectedStrategy>
              )}
                */}
            </Stack>
          )}
          {/*
          <StrategyConfig />
              Add later
              <section>
              <p>
              {jt`We’ll periodically run ${(
              <code>select max()</code>
              )} on the column selected here to check for new results.`}
              </p>
              <Select data={columns} />
TODO: I'm not sure this string translates well
</section>
<section>
<p>{t`Check for new results every...`}</p>
<Select data={durations} />
</section>
            */}
        </Panel>
      </Grid>
    </TabWrapper>
  );
};

/** Button that changes the target, i.e., which thing's cache invalidation strategy is being edited */
export const TargetSwitcher = ({
  db,
  dbConfigs,
  targetId,
  setTargetId,
  deleteDBStrategy,
}: {
  db: Database;
  targetId: number | "root" | null;
  dbConfigs: GetConfigByModelId;
  setTargetId: Dispatch<SetStateAction<number | "root" | null>>;
  deleteDBStrategy: (databaseId: number) => void;
}) => {
  const dbConfig = dbConfigs.get(db.id);
  const rootStrategy = dbConfigs.get("root")?.strategy;
  const savedDBStrategy = dbConfig?.strategy;
  const followsRootStrategy = savedDBStrategy === undefined;
  const strategyForDB = savedDBStrategy ?? rootStrategy;
  if (!strategyForDB) {
    throw new Error(t`Invalid strategy "${JSON.stringify(strategyForDB)}"`);
  }
  const strategyLabel = Strategies[strategyForDB.type]?.label;
  const isBeingEdited = targetId === db.id;
  const clearOverride = () => {
    deleteDBStrategy(db.id);
  };
  return (
    <ConfigButton
      onClick={() => {
        setTargetId(db.id);
      }}
      variant={isBeingEdited ? "filled" : "white"}
      w="100%"
      fw="bold"
      mb="1rem"
      p="1rem"
      miw="20rem"
    >
      <Flex gap="0.5rem">
        <Icon name="database" />
        {db.name}
      </Flex>
      <Chip
        configIsBeingEdited={isBeingEdited}
        onClick={(e: MouseEvent<HTMLButtonElement>) => {
          if (!followsRootStrategy) {
            clearOverride();
            e.stopPropagation();
          }
        }}
        variant={followsRootStrategy || isBeingEdited ? "white" : "filled"}
        ml="auto"
        p="0.75rem 1rem"
      >
        {followsRootStrategy ? (
          t`Use default`
        ) : (
          <>
            {strategyLabel}
            <Icon name="close" />
          </>
        )}
      </Chip>
    </ConfigButton>
  );
};

const StrategySelector = ({
  targetId,
  currentDatabase,
  currentStrategy,
  rootStrategy,
  updateStrategy,
}: {
  targetId: number | "root" | null;
  currentDatabase?: Database;
  currentStrategy?: Strategy;
  rootStrategy?: Strategy;
  updateStrategy: (newStrategyValues: Record<string, string | number>) => void;
}) => {
  const radioButtonMapRef = useRef<Map<string | null, HTMLInputElement>>(
    new Map(),
  );
  const radioButtonMap = radioButtonMapRef.current;

  const inferredStrategyType = currentStrategy?.type ?? rootStrategy?.type;

  useEffect(
    () => {
      if (inferredStrategyType) {
        radioButtonMap.get(inferredStrategyType)?.focus();
      }
    },
    // We only want to focus the radio button when the targetId changes,
    // not when the strategy changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [targetId],
  );

  return (
    <section>
      <Title order={2} mb="1rem">
        {targetId === "root"
          ? rootConfigLabel
          : currentDatabase?.name.trim() || "Untitled database"}
      </Title>
      <Radio.Group
        value={inferredStrategyType}
        name={`caching-strategy-for-${
          targetId === "root" ? "root" : `database-${targetId}`
        }`}
        onChange={strategyType => {
          updateStrategy({ type: strategyType });
        }}
        label={
          <Text lh="1rem">{t`When should cached query results be invalidated?`}</Text>
        }
      >
        <Stack mt="md" spacing="md">
          {Object.entries(Strategies).map(([name, { label }]) => (
            <Radio
              ref={(el: HTMLInputElement) => {
                radioButtonMap.set(name, el);
              }}
              value={name}
              key={name}
              label={label}
            />
          ))}
        </Stack>
      </Radio.Group>
    </section>
  );
};
