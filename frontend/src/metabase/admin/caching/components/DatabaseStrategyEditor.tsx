import type { Dispatch, MouseEvent, SetStateAction } from "react";
import { useEffect, useRef, useState } from "react";
import { t } from "ttag";

import { color } from "metabase/lib/colors";
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

import type {
  DBStrategySetter,
  DefaultMappings,
  DefaultsMap,
  DurationStrategy,
  GetConfigByModelId,
  RootStrategySetter,
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

export const DatabaseStrategyEditor = ({
  databases,
  dbConfigs,
  setRootStrategy,
  setDBStrategy,
  clearDBOverrides,
}: {
  databases: Database[];
  dbConfigs: GetConfigByModelId;
  setDBStrategy: DBStrategySetter;
  setRootStrategy: RootStrategySetter;
  clearDBOverrides: () => void;
}) => {
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
