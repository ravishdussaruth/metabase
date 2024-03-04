import type { Dispatch, MouseEvent, SetStateAction } from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { t } from "ttag";
import _ from "underscore";
import { useAsync } from "react-use";
import type Database from "metabase-lib/metadata/Database";
import { useDatabaseListQuery } from "metabase/common/hooks";
import LoadingAndErrorWrapper from "metabase/components/LoadingAndErrorWrapper";
import { color } from "metabase/lib/colors";
import { useDispatch } from "metabase/lib/redux";
import { addUndo } from "metabase/redux/undo";
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
import type {
  Config,
  DBStrategySetter,
  DefaultMappings,
  DefaultsMap,
  DurationStrategy,
  GetConfigByModelId,
  Model,
  Strategy,
  StrategyType,
  TTLStrategy,
} from "../types";
import {
  initialStrategyDefaults,
  isValidStrategy,
  rootConfigLabel,
  Strategies,
} from "../types";
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
} from "./DatabaseStrategyEditor.styled";

const defaultRootStrategy: Strategy = { type: "nocache" };

export const DatabaseStrategyEditor = ({
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
    (model: Model, model_id: number, newStrategy: Strategy | null) => {
      const baseConfig: Pick<Config, "model" | "model_id"> = {
        model,
        model_id,
      };
      const otherConfigs = configs.filter(
        config => config.model_id !== model_id,
      );

      const oldConfig = dbConfigs.get(model_id);
      const onSuccess = async () => {
        await showSuccessToast();
      };
      const onError = async () => {
        await showErrorToast();
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

  const setRootStrategy = (strategy: Strategy) =>
    setStrategy("root", 0, strategy);
  const setDBStrategy = (databaseId: number, strategy: Strategy) =>
    setStrategy("database", databaseId, strategy);

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
  }, [tabsRef, areDatabasesLoading, areConfigsLoading, areConfigsLoading]);

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

  /** Id of the database currently being edited, or 'root' for the root strategy */
  const [currentId, setCurrentId] = useState<number | "root" | null>(null);
  const rootStrategy = dbConfigs.get("root")?.strategy;
  const rootStrategyLabel = rootStrategy
    ? Strategies[rootStrategy?.type]?.label
    : null;
  const currentStrategy = dbConfigs.get(currentId)?.strategy;
  const currentDatabase = databases.find(db => db.id === currentId);

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

  const updateStrategy = (newStrategyValues: Partial<Strategy>) => {
    const strategyType: StrategyType | undefined =
      newStrategyValues?.type ?? currentStrategy?.type;
    const relevantDefaults =
      currentId && strategyType
        ? defaults.get(currentId)?.[strategyType]
        : null;
    const newStrategy = {
      ...relevantDefaults,
      ...newStrategyValues,
    };
    if (!isValidStrategy(newStrategy)) {
      console.error(`Invalid strategy: ${JSON.stringify(newStrategy)}`);
      return false;
    }
    if (currentId === "root") {
      setRootStrategy(newStrategy);
    } else if (currentId !== null) {
      setDBStrategy(currentId, newStrategy);
    } else {
      console.error("No target specified");
    }
  };

  const showEditor = currentId !== null;

  const handleFormSubmit = (values: Partial<Strategy>) => {
    updateStrategy({ ...currentStrategy, ...values });
  };

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
              setCurrentId("root");
            }}
            variant={currentId === "root" ? "filled" : "white"}
            p="1rem"
            miw="20rem"
            fw="bold"
          >
            <Flex gap="0.5rem">
              <Icon name="database" />
              {t`Databases`}
            </Flex>
            <Chip variant={currentId !== "root" ? "filled" : "white"}>
              {rootStrategyLabel}
            </Chip>
          </ConfigButton>
        </Panel>
        <Panel role="group">
          {databases.map(db => (
            <ClickThisToConfigureADatabase
              db={db}
              key={db.id.toString()}
              dbConfigs={dbConfigs}
              setDBStrategy={setDBStrategy}
              currentId={currentId}
              setCurrentId={setCurrentId}
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
              <PickAStrategy
                currentId={currentId}
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

export const ClickThisToConfigureADatabase = ({
  db,
  dbConfigs,
  currentId,
  setCurrentId,
  setDBStrategy,
}: {
  db: Database;
  currentId: number | "root" | null;
  dbConfigs: GetConfigByModelId;
  setCurrentId: Dispatch<SetStateAction<number | "root" | null>>;
  setDBStrategy: DBStrategySetter;
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
  const isBeingEdited = currentId === db.id;
  const clearOverride = () => {
    setDBStrategy(db.id, null);
  };
  return (
    <ConfigButton
      onClick={() => {
        setCurrentId(db.id);
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
        fw="bold"
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

const PickAStrategy = ({
  currentId,
  currentDatabase,
  currentStrategy,
  rootStrategy,
  updateStrategy,
}: {
  currentId: number | "root" | null;
  currentDatabase?: Database;
  currentStrategy?: Strategy;
  rootStrategy?: Strategy;
  updateStrategy: (newStrategyValues: Record<string, string | number>) => void;
}) => {
  const radioButtonMapRef = useRef<Map<string | null, HTMLInputElement>>(
    new Map(),
  );

  const inferredStrategyType = currentStrategy?.type ?? rootStrategy?.type;

  useEffect(
    () => {
      if (inferredStrategyType) {
        radioButtonMapRef.current?.get(inferredStrategyType)?.focus();
      }
    },
    // We only want to focus the radio button when the currentId changes,
    // not when the strategy changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentId],
  );

  return (
    <section>
      <Title order={2} mb="1rem">
        {currentId === "root"
          ? rootConfigLabel
          : currentDatabase?.name.trim() || "Untitled database"}
      </Title>
      <Radio.Group
        value={inferredStrategyType}
        name={`caching-strategy-for-${
          currentId === "root" ? "root" : `database-${currentId}`
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
                radioButtonMapRef.current.set(name, el);
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
