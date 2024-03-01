import type { Dispatch, MouseEvent, SetStateAction } from "react";
import { useEffect, useState } from "react";
import { t } from "ttag";
import _ from "underscore";
import * as Yup from "yup";

import { Form, FormProvider, FormTextInput } from "metabase/forms";
import { color } from "metabase/lib/colors";
import type { ButtonProps } from "metabase/ui";
import { Icon, Radio, Text, Title } from "metabase/ui";
import type Database from "metabase-lib/metadata/Database";

import type {
  Config,
  DBStrategySetter,
  GetConfigByModelId,
  RootStrategySetter,
  Strategy,
  TTLStrategy,
} from "../types";
import { isValidStrategy, Strategies } from "../types";

import {
  ClearOverridesButton,
  ConfigPanel,
  ConfigPanelSection,
  DatabaseConfigDisplayStyled,
  DatabasesConfigIcon,
  Editor,
  EditorPanel,
  Explanation,
  RootConfigDisplay,
  StrategyDisplay,
  TabWrapper,
} from "./DatabaseStrategyEditor.styled";

export const DatabaseStrategyEditor = ({
  databases,
  rootStrategy,
  dbConfigs,
  setRootStrategy,
  setDBStrategy,
  clearDBOverrides,
}: {
  rootStrategy: Strategy;
  databases: Database[];
  dbConfigs: GetConfigByModelId;
  setDBStrategy: DBStrategySetter;
  setRootStrategy: RootStrategySetter;
  clearDBOverrides: () => void;
}) => {
  /** Id of the database currently being edited */
  const [targetId, setTargetId] = useState<number | null>(null);
  const [editingRootConfig, setEditingRootConfig] = useState<boolean>(false);

  const rootStrategyLabel = rootStrategy
    ? Strategies[rootStrategy?.type]?.label
    : null;
  const currentStrategy = editingRootConfig
    ? rootStrategy
    : targetId === null
    ? null
    : dbConfigs.get(targetId)?.strategy;

  const initialTTLDefaults = new Map(
    databases.map(db => [
      db.id,
      {
        min_duration: 1,
        multiplier: 1,
      },
    ]),
  );
  const [ttlDefaults, setTTLDefaults] =
    useState<Map<number, Partial<TTLStrategy>>>(initialTTLDefaults);
  // const [defaultsForQueryStrategy, setDefaultsForQueryStrategy] = useState({ field_id: 0, aggregation: "", schedule: "" });

  useEffect(() => {
    if (targetId === null) {
      return;
    }
    if (currentStrategy?.type === "ttl") {
      setTTLDefaults((defaults: Map<number, Partial<TTLStrategy>>) => {
        // Update defaults with values in newStrategy
        const prevDefaults = defaults.get(targetId);
        const newDefaults = _.pick(
          currentStrategy,
          "min_duration",
          "multiplier",
        );
        const merged = {
          ...prevDefaults,
          ...newDefaults,
        };
        defaults.set(targetId, merged);
        return defaults;
      });
    }
  }, [currentStrategy, targetId, setTTLDefaults]);

  const updateDatabaseStrategy = (
    newStrategyValues: Record<string, string | number>,
  ) => {
    const type = newStrategyValues?.type ?? currentStrategy?.type;
    let newStrategy = {};
    if (type === "ttl") {
      const defaultsForTTLStrategyForThisDB = targetId
        ? ttlDefaults.get(targetId)
        : null;
      newStrategy = {
        ...defaultsForTTLStrategyForThisDB,
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
    if (editingRootConfig) {
      setRootStrategy(newStrategy);
    } else if (targetId !== null) {
      setDBStrategy(targetId, newStrategy);
    } else {
      console.error("No target specified");
    }
  };

  const showEditor = editingRootConfig || targetId !== null;

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
          <RootConfigDisplay
            {...getButtonProps({
              shouldHighlightButton: editingRootConfig,
            })}
            onClick={() => {
              setEditingRootConfig(true);
              setTargetId(null);
            }}
          >
            <DatabasesConfigIcon name="database" />
            {t`Databases`}
            <StrategyDisplay
              {...getButtonProps({
                shouldHighlightButton: !editingRootConfig,
              })}
            >
              {rootStrategyLabel}
            </StrategyDisplay>
          </RootConfigDisplay>
        </EditorPanel>
        <EditorPanel role="group">
          {databases.map(db => (
            <DatabaseConfigDisplay
              db={db}
              key={db.id.toString()}
              dbConfigs={dbConfigs}
              setDBStrategy={setDBStrategy}
              targetDatabaseId={targetId}
              setEditingWhichDatabaseId={databaseId => {
                setEditingRootConfig(false);
                setTargetId(databaseId);
              }}
              rootStrategy={rootStrategy}
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
                  Database {targetId}
                </Title>
                <Radio.Group
                  value={currentStrategy?.type ?? rootStrategy?.type}
                  name={`caching-strategy-for-database-${targetId}`}
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
  setDBStrategy,
  targetDatabaseId,
  setEditingWhichDatabaseId,
  rootStrategy,
}: {
  db: Database;
  key: string;
  targetDatabaseId: number | null;
  setEditingWhichDatabaseId: Dispatch<SetStateAction<number | null>>;
  dbConfigs: Map<number, Config>;
  setDBStrategy: DBStrategySetter;
  rootStrategy: Strategy | undefined;
}) => {
  const dbConfig = dbConfigs.get(db.id);
  const savedDBStrategy = dbConfig?.strategy;
  const overridesRoot =
    savedDBStrategy !== undefined &&
    savedDBStrategy.type !== rootStrategy?.type;
  // TODO: When other kinds of strategies are added we will need a deeper check.
  const strategyForDB = savedDBStrategy ?? rootStrategy;
  if (!strategyForDB) {
    throw new Error(t`Invalid strategy "${strategyForDB}"`);
  }
  const strategyLabel = Strategies[strategyForDB.type]?.label;
  const isBeingEdited = targetDatabaseId === db.id;
  const clearOverride = () => {
    setDBStrategy(db.id, null);
  };
  const shouldHighlightButton = overridesRoot && !isBeingEdited;
  return (
    <DatabaseConfigDisplayStyled
      {...getButtonProps({ shouldHighlightButton: isBeingEdited })}
      key={key}
      onClick={() => {
        setEditingWhichDatabaseId(db.id);
      }}
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

export const ttlStrategyValidationSchema = Yup.object({
  min_duration: Yup.number()
    .positive(t`The minimum query duration must be a positive number.`)
    .integer(t`The minimum query duration must be an integer.`)
    .required(t`Required field`),
  multiplier: Yup.number()
    .positive(t`The multiplier must be a positive number.`)
    .integer(t`The multiplier must be an integer.`)
    .required(t`Required field`),
});

// TODO: maybe use Mantine's Stack component in conjunction with or instead of ConfigPanelSection

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
      name={fieldName as string} // TODO: Remove this 'as'
      type="number"
      min={1}
      styles={{ input: { maxWidth: "5rem" } }}
      autoComplete="off"
    />
  );
};
