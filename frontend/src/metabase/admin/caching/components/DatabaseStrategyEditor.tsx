import type { Dispatch, MouseEvent, SetStateAction } from "react";
import { useEffect, useState } from "react";
import { t } from "ttag";
import * as Yup from "yup";

import { Form, FormProvider, FormTextInput } from "metabase/forms";
import { color } from "metabase/lib/colors";
import type { ButtonProps } from "metabase/ui";
import { Icon, Radio, Text, Title } from "metabase/ui";
import type Database from "metabase-lib/metadata/Database";

import type {
  DBStrategySetter,
  GetConfigByModelId,
  RootStrategySetter,
  TTLStrategy,
} from "../types";
import { isValidStrategy, Strategies } from "../types";

import {
  ClearOverridesButton,
  ConfigDisplay,
  ConfigPanel,
  ConfigPanelSection,
  DatabaseConfigDisplayStyled,
  DatabasesConfigIcon,
  Editor,
  EditorPanel,
  Explanation,
  StrategyDisplay,
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

  const ttlInitialDefault = {
    min_duration: 1,
    multiplier: 1,
  };

  const [ttlDefaults, setTTLDefaults] = useState<
    Map<number | "root", Partial<TTLStrategy>>
  >(() => new Map(databases.map(db => [db.id, ttlInitialDefault])));

  if (!ttlDefaults.has("root")) {
    ttlDefaults.set("root", ttlInitialDefault);
  }

  // const [defaultsForQueryStrategy, setDefaultsForQueryStrategy] = useState({ field_id: 0, aggregation: "", schedule: "" });

  useEffect(() => {
    if (currentId === null) {
      return;
    }
    if (currentStrategy?.type === "ttl") {
      setTTLDefaults((defaults: Map<number | "root", Partial<TTLStrategy>>) => {
        // Update defaults with values in the current strategy
        const defaultsForCurrentId = defaults.get(currentId) ?? {};
        if (isValidMinDuration(currentStrategy.min_duration)) {
          defaultsForCurrentId.min_duration = currentStrategy.min_duration;
        }
        if (isValidMultiplier(currentStrategy.multiplier)) {
          defaultsForCurrentId.multiplier = currentStrategy.multiplier;
        }
        defaults.set(currentId, defaultsForCurrentId);
        return defaults;
      });
    }
  }, [currentStrategy, currentId, setTTLDefaults]);

  const updateDatabaseStrategy = (
    newStrategyValues: Record<string, string | number>,
  ) => {
    const type = newStrategyValues?.type ?? currentStrategy?.type;
    let newStrategy = {};
    if (type === "ttl") {
      const ttlDefaultsForCurrentId = currentId
        ? ttlDefaults.get(currentId)
        : null;
      newStrategy = {
        ...ttlDefaultsForCurrentId,
        ...newStrategyValues,
      };
    } else {
      newStrategy = newStrategyValues;
    }
    // newStrategyValues.type === 'query' ? { ...defaultsForQueryStrategy, ...newStrategyProperties }
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

  return (
    <TabWrapper role="region" aria-label="Data caching settings">
      <Explanation>
        {t`Cache the results of queries to have them display instantly. Here you can choose when cached results should be invalidated. You can set up one rule for all your databases, or apply more specific settings to each database.`}
      </Explanation>
      <Editor role="form">
        <EditorPanel
          role="group"
          style={{ backgroundColor: color("bg-light") }}
        >
          <ConfigDisplay
            {...getButtonProps({
              shouldHighlightButton: currentId === "root",
            })}
            onClick={() => {
              setCurrentId("root");
            }}
          >
            <DatabasesConfigIcon name="database" />
            {t`Databases`}
            <StrategyDisplay
              {...getButtonProps({
                shouldHighlightButton: currentId !== "root",
              })}
            >
              {rootStrategyLabel}
            </StrategyDisplay>
          </ConfigDisplay>
        </EditorPanel>
        <EditorPanel role="group">
          {databases.map(db => (
            <DatabaseConfigDisplay
              db={db}
              key={db.id.toString()}
              dbConfigs={dbConfigs}
              setDBStrategy={setDBStrategy}
              currentId={currentId}
              setCurrentId={setCurrentId}
            />
          ))}
          <ClearOverridesButton
            onClick={() => {
              clearDBOverrides();
            }}
          >{t`Clear all overrides`}</ClearOverridesButton>
        </EditorPanel>
        <ConfigPanel role="group">
          {showEditor && (
            <>
              <ConfigPanelSection>
                <Title order={2} mb="1rem">
                  {currentId === "root"
                    ? "Default for all databases"
                    : currentDatabase?.name.trim() || "Untitled database"}
                </Title>
                <Radio.Group
                  value={currentStrategy?.type ?? rootStrategy?.type}
                  name={`caching-strategy-for-database-${currentId}`}
                  onChange={strategyType => {
                    updateDatabaseStrategy({ type: strategyType });
                  }}
                  label={
                    <Text lh="1rem">{t`When should cached query results be invalidated?`}</Text>
                  }
                >
                  {/*
                Add later:
                <Radio mt=".75rem" value="query" label={t`When the data updates`} />
                <Radio mt=".75rem" value="schedule" label={t`On a schedule`} />
              */}
                  <Radio
                    mt=".75rem"
                    value="ttl"
                    label={t`When the TTL expires`}
                  />
                  {/*
                <Radio
                  mt=".75rem"
                  value="duration"
                  label={t`On a regular duration`}
                />
                */}
                  <Radio mt=".75rem" value="nocache" label={t`Don't cache`} />
                </Radio.Group>
              </ConfigPanelSection>
              {currentStrategy?.type === "ttl" && (
                <TTLStrategyEditor
                  updateStrategy={updateDatabaseStrategy}
                  currentStrategy={currentStrategy}
                />
              )}
            </>
          )}
          {/*
          <StrategyConfig />
              Add later
          <ConfigPanelSection>
            <p>
              {jt`We’ll periodically run ${(
                <code>select max()</code>
              )} on the column selected here to check for new results.`}
            </p>
            <Select data={columns} />
             TODO: I'm not sure this string translates well
          </ConfigPanelSection>
          <ConfigPanelSection>
            <p>{t`Check for new results every...`}</p>
            <Select data={durations} />
          </ConfigPanelSection>
            */}
        </ConfigPanel>
      </Editor>
    </TabWrapper>
  );
};

export const DatabaseConfigDisplay = ({
  db,
  key,
  dbConfigs,
  currentId,
  setCurrentId,
  setDBStrategy,
}: {
  db: Database;
  key: string;
  currentId: number | "root" | null;
  dbConfigs: GetConfigByModelId;
  setCurrentId: Dispatch<SetStateAction<number | "root" | null>>;
  setDBStrategy: DBStrategySetter;
}) => {
  const dbConfig = dbConfigs.get(db.id);
  const rootStrategy = dbConfigs.get("root")?.strategy;
  const savedDBStrategy = dbConfig?.strategy;
  const overridesRoot = savedDBStrategy !== undefined;
  const strategyForDB = savedDBStrategy ?? rootStrategy;
  if (!strategyForDB) {
    throw new Error(t`Invalid strategy "${JSON.stringify(strategyForDB)}"`);
  }
  const strategyLabel = Strategies[strategyForDB.type]?.label;
  const isBeingEdited = currentId === db.id;
  const clearOverride = () => {
    setDBStrategy(db.id, null);
  };
  const shouldHighlightButton = overridesRoot && !isBeingEdited;
  return (
    <DatabaseConfigDisplayStyled
      key={key}
      onClick={() => {
        setCurrentId(db.id);
      }}
      w="100%"
      fw="bold"
      mb="1rem"
      p="1rem"
      miw="20rem"
      {...getButtonProps({ shouldHighlightButton: isBeingEdited })}
    >
      <DatabasesConfigIcon name="database" />
      {db.name}
      <StrategyDisplay
        {...getButtonProps({ shouldHighlightButton })}
        onClick={(e: MouseEvent<HTMLButtonElement>) => {
          if (overridesRoot) {
            clearOverride();
            e.stopPropagation();
          }
        }}
      >
        {strategyLabel}
        {overridesRoot && <Icon style={{ marginLeft: ".5rem" }} name="close" />}
      </StrategyDisplay>
    </DatabaseConfigDisplayStyled>
  );
};

// TODO: No bueno, get rid of this
export const getButtonProps = ({
  shouldHighlightButton,
}: {
  shouldHighlightButton: boolean;
}): ButtonProps => {
  return {
    radius: "sm",
    style: {
      border: shouldHighlightButton
        ? `1px solid ${color("brand")}`
        : `1px solid ${color("border")}`,
    },
    variant: shouldHighlightButton ? "filled" : "white",
    animate: false,
  };
};

const minDurationValidationSchema = Yup.number()
  .positive(t`The minimum query duration must be a positive number.`)
  .integer(t`The minimum query duration must be an integer.`)
  .required(t`Required field`);
const isValidMinDuration = (x: unknown) =>
  minDurationValidationSchema.isValidSync(x);

const multiplierValidationSchema = Yup.number()
  .positive(t`The multiplier must be a positive number.`)
  .integer(t`The multiplier must be an integer.`)
  .required(t`Required field`);
const isValidMultiplier = (x: unknown) =>
  multiplierValidationSchema.isValidSync(x);

export const ttlStrategyValidationSchema = Yup.object({
  min_duration: minDurationValidationSchema,
  multiplier: multiplierValidationSchema,
});

// TODO: maybe use Mantine's Stack component in conjunction with or instead of ConfigPanelSection

// TODO: Use Form's onChange prop so you don't need a separate StrategyPositiveNumberInput component
const TTLStrategyEditor = ({
  currentStrategy,
  updateStrategy,
}: {
  currentStrategy: TTLStrategy;
  updateStrategy: (newStrategyValues: Record<string, string | number>) => void;
}) => {
  const handleSubmit = (values: Partial<TTLStrategy>) => {
    updateStrategy({ ...currentStrategy, ...values });
  };
  return (
    <FormProvider
      initialValues={currentStrategy}
      validationSchema={ttlStrategyValidationSchema}
      onSubmit={handleSubmit}
      enableReinitialize
    >
      <Form onSubmit={e => e.preventDefault()}>
        <ConfigPanelSection>
          <Title order={3}>{t`Minimum query duration`}</Title>
          <p>
            {t`Metabase will cache all saved questions with an average query execution time longer than this many seconds:`}
          </p>
          <StrategyPositiveNumberInput
            fieldName="min_duration"
            handleSubmit={handleSubmit}
          />
        </ConfigPanelSection>
        <ConfigPanelSection>
          <Title order={3}>{t`Cache time-to-live (TTL) multiplier`}</Title>
          <p>
            {t`To determine how long each saved question's cached result should stick around, we take the query's average execution time and multiply that by whatever you input here. So if a query takes on average 2 minutes to run, and you input 10 for your multiplier, its cache entry will persist for 20 minutes.`}
          </p>
          <StrategyPositiveNumberInput
            fieldName="multiplier"
            handleSubmit={handleSubmit}
          />
        </ConfigPanelSection>
      </Form>
    </FormProvider>
  );
};

export const StrategyPositiveNumberInput = ({
  fieldName,
  handleSubmit,
}: {
  fieldName: string;
  handleSubmit: (values: Partial<TTLStrategy>) => void;
}) => {
  return (
    <FormTextInput
      onChange={e =>
        handleSubmit({
          [fieldName]: Number(e.target.value.trim() || null),
        })
      }
      name={fieldName}
      type="number"
      min={1}
      styles={{ input: { maxWidth: "5rem" } }}
      autoComplete="off"
    />
  );
};
