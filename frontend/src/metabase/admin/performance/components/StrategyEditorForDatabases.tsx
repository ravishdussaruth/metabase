import type { Dispatch, SetStateAction } from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAsync } from "react-use";
import { c, t } from "ttag";
import _ from "underscore";

import { useDatabaseListQuery } from "metabase/common/hooks";
import LoadingAndErrorWrapper from "metabase/components/LoadingAndErrorWrapper";
import {
  Form,
  FormProvider,
  FormRadioGroup,
  FormSubmitButton,
  FormTextInput,
} from "metabase/forms";
import { color } from "metabase/lib/colors";
import { PLUGIN_CACHING } from "metabase/plugins";
import { CacheConfigApi } from "metabase/services";
import { Box, Flex, Grid, Icon, Radio, Stack, Text, Title } from "metabase/ui";
import type Database from "metabase-lib/metadata/Database";

import type { DefaultsMap } from "../hooks/useDefaults";
import { useStrategyDefaults } from "../hooks/useDefaults";
import { useRequests } from "../hooks/useRequests";
import type {
  Config,
  GetConfigByModelId,
  Model,
  Strat,
  StrategyType,
} from "../types";
import {
  getShortStrategyLabel,
  getStrategyLabel,
  isValidStrategy,
  Strategies,
} from "../types";
import { strategyValidationSchema } from "../validation";

import {
  Chip,
  ConfigButton,
  Panel,
  TabWrapper,
} from "./StrategyEditorForDatabases.styled";

const defaultRootStrategy: Strat = { type: "nocache" };

export const StrategyEditorForDatabases = ({
  tabsRef,
  setTabsHeight,
}: {
  tabsRef: React.RefObject<HTMLDivElement>;
  setTabsHeight: (height: number) => void;
}) => {
  const {
    data: unfilteredDatabases = null,
    error: errorWhenLoadingDatabases,
    isLoading: areDatabasesLoading,
  } = useDatabaseListQuery();

  const databases = unfilteredDatabases?.filter(
    PLUGIN_CACHING.canConfigureDatabase,
  );

  const canOnlyConfigureRootStrategy = databases?.length === 0;

  const {
    value: configsFromAPI,
    loading: areConfigsLoading,
    error: errorWhenLoadingConfigs,
  }: {
    value?: Config[];
    loading: boolean;
    error?: any;
  } = useAsync(async () => {
    const lists = [CacheConfigApi.list({ model: "root" })];
    if (!canOnlyConfigureRootStrategy) {
      lists.push(CacheConfigApi.list({ model: "database" }));
    }
    const [rootConfigsFromAPI, savedConfigsFromAPI] = await Promise.all(lists);
    const configs = [
      ...(rootConfigsFromAPI?.items ?? []),
      ...(savedConfigsFromAPI?.items ?? []),
    ];
    return configs;
  }, []);

  const [configs, setConfigs] = useState<Config[]>([]);

  const [isOverridePanelVisible, setIsOverridePanelVisible] = useState(false);

  useEffect(() => {
    if (configsFromAPI) {
      setConfigs(configsFromAPI);
    }
  }, [configsFromAPI]);

  const savedConfigs: GetConfigByModelId = useMemo(() => {
    const map: GetConfigByModelId = new Map();
    databases?.forEach(db => {
      const matchingConfig = configs.find(config => config.model_id === db.id);
      if (matchingConfig) {
        map.set(db.id, matchingConfig);
      }
    });
    const savedRootStrategy = configs.find(
      config => config.model === "root",
    )?.strategy;
    if (savedRootStrategy) {
      map.set("root", {
        model: "root",
        model_id: 0,
        strategy: savedRootStrategy,
      });
    }
    return map;
  }, [configs, databases]);

  /** Id of the database currently being edited, or 'root' for the root strategy */
  const [targetId, setTargetId] = useState<number | "root" | null>(null);

  const rootStrategy =
    savedConfigs.get("root")?.strategy ?? defaultRootStrategy;

  /** The config for the currently edited database, or the root strategy */
  const targetConfig = savedConfigs.get(targetId);
  const currentStrategy = targetConfig?.strategy;
  const defaults = useStrategyDefaults(databases, targetConfig);

  const { debouncedRequest, showSuccessToast, showErrorToast } = useRequests();

  useEffect(() => {
    if (canOnlyConfigureRootStrategy) {
      setTargetId("root");
    }
  }, [canOnlyConfigureRootStrategy]);

  const setStrategy = useCallback(
    (model: Model, model_id: number, newStrategy: Strat | null) => {
      const baseConfig: Pick<Config, "model" | "model_id"> = {
        model,
        model_id,
      };
      const otherConfigs = configs.filter(
        config => config.model_id !== model_id,
      );

      const configBeforeChange = savedConfigs.get(model_id);
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
    [configs, savedConfigs, debouncedRequest, showErrorToast, showSuccessToast],
  );

  const setRootStrategy = (newStrategy: Strat) =>
    setStrategy("root", 0, newStrategy);
  const setDBStrategy = (databaseId: number, newStrategy: Strat | null) =>
    setStrategy("database", databaseId, newStrategy);

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
  }, [tabsRef, setTabsHeight, areDatabasesLoading, areConfigsLoading]);

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

  const showEditor = targetId !== null;

  const updateStrategy = (newStrategyValues: Partial<Strat> | null) => {
    const strategyType: StrategyType | undefined =
      newStrategyValues?.type ?? currentStrategy?.type;
    const relevantDefaults =
      targetId && strategyType ? defaults?.get(targetId)?.[strategyType] : null;
    const newStrategy = newStrategyValues
      ? {
          ...relevantDefaults,
          ...newStrategyValues,
        }
      : null;
    if (newStrategy !== null && !isValidStrategy(newStrategy)) {
      console.error(`Invalid strategy: ${JSON.stringify(newStrategy)}`);
      return;
    }
    if (targetId === "root") {
      if (newStrategy === null) {
        console.error("Cannot delete root strategy");
      } else {
        setRootStrategy(newStrategy);
      }
    } else if (targetId !== null) {
      setDBStrategy(targetId, newStrategy);
    } else {
      console.error("No target specified");
    }
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
        {PLUGIN_CACHING.explanation}
      </Text>
      <Grid
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          overflow: "hidden",
        }}
        w="100%"
        mb="1rem"
      >
        {!canOnlyConfigureRootStrategy && (
          <>
            <Panel role="group" style={{ backgroundColor: color("bg-light") }}>
              <ConfigButton
                p="1rem"
                miw="20rem"
                fw="bold"
                mb=".5rem"
                styles={{
                  label: { flexDirection: "column", alignItems: "stretch" },
                }}
                onClick={() => {
                  if (!isOverridePanelVisible) {
                    setTargetId(null);
                  }
                  setIsOverridePanelVisible(isVisible => !isVisible);
                }}
              >
                <Flex gap="0.5rem" w="100%">
                  <Icon name="database" />
                  {t`Databases`}
                </Flex>
              </ConfigButton>
              <Chip
                p="0.75rem 1rem"
                w="100%"
                variant={targetId === "root" ? "filled" : "white"}
                onClick={() => {
                  setTargetId("root");
                  setIsOverridePanelVisible(false);
                }}
              >
                {getStrategyLabel(rootStrategy)}
              </Chip>
            </Panel>
            <Panel role="group">
              {isOverridePanelVisible &&
                databases?.map(db => (
                  <DatabaseWidget
                    db={db}
                    key={db.id.toString()}
                    savedConfigs={savedConfigs}
                    targetId={targetId}
                    setTargetId={setTargetId}
                  />
                ))}
            </Panel>
          </>
        )}
        {showEditor && (
          <Editor
            currentStrategy={currentStrategy}
            targetId={targetId}
            updateStrategy={updateStrategy}
            defaults={defaults}
          />
        )}
      </Grid>
    </TabWrapper>
  );
};

export const Editor = ({
  currentStrategy,
  targetId,
  updateStrategy,
  defaults,
}: {
  currentStrategy?: Strat;
  targetId: number | "root";
  updateStrategy: (newStrategy: Partial<Strat> | null) => void;
  defaults: DefaultsMap | null;
}) => {
  const currentStrategyType = currentStrategy?.type ?? "inherit";

  /** The strategy displayed in the form. It might not be saved yet. */
  const [selectedStrategyType, setSelectedStrategyType] =
    useState<StrategyType>(currentStrategyType);

  const defaultsForCurrentTargetAndStrategy =
    defaults?.get(targetId)?.[selectedStrategyType];

  const selectedStrategy = {
    ...defaultsForCurrentTargetAndStrategy,
    type: selectedStrategyType,
  } as Strat;

  const handleFormSubmit = (values: Partial<Strat>) => {
    updateStrategy(
      values.type === "inherit"
        ? null // Delete the strategy
        : { ...currentStrategy, ...values },
    );
  };

  return (
    <Panel>
      <FormProvider<Strat>
        initialValues={selectedStrategy}
        validationSchema={strategyValidationSchema}
        onSubmit={handleFormSubmit}
        enableReinitialize
      >
        <Form>
          <Stack spacing="xl">
            <StrategySelector
              targetId={targetId}
              currentStrategy={selectedStrategy}
              setSelectedStrategy={setSelectedStrategyType}
            />
            {selectedStrategyType === "ttl" && (
              <>
                <section>
                  <Title order={3}>{t`Minimum query duration`}</Title>
                  <p>
                    {t`Metabase will cache all saved questions with an average query execution time longer than this many seconds:`}
                  </p>
                  <PositiveNumberInput fieldName="min_duration" />
                </section>
                <section>
                  <Title
                    order={3}
                  >{t`Cache time-to-live (TTL) multiplier`}</Title>
                  <p>
                    {t`To determine how long each saved question's cached result should stick around, we take the query's average execution time and multiply that by whatever you input here. So if a query takes on average 2 minutes to run, and you input 10 for your multiplier, its cache entry will persist for 20 minutes.`}
                  </p>
                  <PositiveNumberInput fieldName="multiplier" />
                </section>
              </>
            )}
            {selectedStrategyType === "duration" && (
              <section>
                <Title order={3}>{t`Cache result for this many hours`}</Title>
                <PositiveNumberInput fieldName="duration" />
              </section>
            )}
            {/*
              {selectedStrategy === "schedule" && (
                  <section>
                    <Title order={3}>{t`Schedule`}</Title>
                    <p>{t`(explanation goes here)`}</p>
                    <CronInput
                      initialValue={currentStrategy.schedule}
                    />
                  </section>
              )}
                */}
            <FormSubmitButton disabled={false} />
          </Stack>
        </Form>
      </FormProvider>
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
  );
};

export const DatabaseWidget = ({
  db,
  savedConfigs,
  targetId,
  setTargetId,
}: {
  db: Database;
  targetId: number | "root" | null;
  savedConfigs: GetConfigByModelId;
  setTargetId: Dispatch<SetStateAction<number | "root" | null>>;
}) => {
  const dbConfig = savedConfigs.get(db.id);
  const rootStrategy = savedConfigs.get("root")?.strategy;
  const savedDBStrategy = dbConfig?.strategy;
  const inheritsRootStrategy = savedDBStrategy === undefined;
  const strategyForDB = savedDBStrategy ?? rootStrategy;
  if (!strategyForDB) {
    throw new Error(t`Invalid strategy "${JSON.stringify(strategyForDB)}"`);
  }
  const isBeingEdited = targetId === db.id;
  return (
    <Box w="100%" fw="bold" mb="1rem" p="1rem" miw="20rem">
      <Stack spacing="md">
        <Flex gap="0.5rem">
          <Icon name="database" />
          {db.name}
        </Flex>
        <Chip
          configIsBeingEdited={isBeingEdited}
          onClick={() => {
            setTargetId(db.id);
          }}
          variant={isBeingEdited ? "filled" : "white"}
          ml="auto"
          w="100%"
          p="0.75rem 1rem"
        >
          {inheritsRootStrategy
            ? c(
                "This label indicates that a database inherits its behavior from something else",
              ).jt`Inherit:${(
                <Box opacity={0.6}>{getShortStrategyLabel(rootStrategy)}</Box>
              )}`
            : getShortStrategyLabel(strategyForDB)}
        </Chip>
      </Stack>
    </Box>
  );
};

const StrategySelector = ({
  targetId,
  currentStrategy,
  setSelectedStrategy,
}: {
  targetId: number | "root" | null;
  currentStrategy?: Strat;
  setSelectedStrategy: Dispatch<SetStateAction<StrategyType>>;
}) => {
  const radioButtonMapRef = useRef<Map<string | null, HTMLInputElement>>(
    new Map(),
  );
  const radioButtonMap = radioButtonMapRef.current;
  const currentStrategyType = currentStrategy?.type ?? "inherit";

  useEffect(
    () => {
      if (currentStrategyType) {
        radioButtonMap.get(currentStrategyType)?.focus();
      }
    },
    // We only want to focus the radio button when the targetId changes,
    // not when the strategy changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [targetId],
  );

  const availableStrategies =
    targetId === "root" ? _.omit(Strategies, "inherit") : Strategies;

  return (
    <section>
      <FormRadioGroup
        label={
          <Text lh="1rem">{t`When should cached query results be invalidated?`}</Text>
        }
        name="type"
        onChange={(value: string) => {
          setSelectedStrategy(value as StrategyType);
        }}
      >
        <Stack mt="md" spacing="md">
          {_.map(availableStrategies, (option, name) => (
            <Radio
              ref={(el: HTMLInputElement) => {
                radioButtonMap.set(name, el);
              }}
              value={name}
              key={name}
              label={option.label}
            />
          ))}
        </Stack>
      </FormRadioGroup>
    </section>
  );
};

export const PositiveNumberInput = ({ fieldName }: { fieldName: string }) => {
  // NOTE: Known bug: on Firefox, if you type invalid input, the error
  // message will be "Required field" instead of "must be a positive number".
  return (
    <FormTextInput
      name={fieldName}
      type="number"
      min={1}
      styles={{ input: { textAlign: "right", maxWidth: "5rem" } }}
      autoComplete="off"
    />
  );
};
