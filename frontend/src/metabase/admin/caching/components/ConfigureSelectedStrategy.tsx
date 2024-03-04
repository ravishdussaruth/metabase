import type { AnySchema } from "yup";

// import CronExpressionInput from "metabase/admin/settings/components/widgets/ModelCachingScheduleWidget/CronExpressionInput";
import { Form, FormProvider, FormTextInput } from "metabase/forms";
import { Stack } from "metabase/ui";

import type { Strategy, TTLStrategy } from "../types";

export const ConfigureSelectedStrategy = <T extends Strategy>({
  currentStrategy,
  updateStrategy,
  validationSchema,
  children,
}: {
  currentStrategy: T;
  validationSchema: AnySchema;
  updateStrategy: (newStrategyValues: Record<string, string | number>) => void;
  children: React.ReactNode;
}) => {
  const handleSubmit = (values: Partial<T>) => {
    // TODO: check that validation at this point makes sense
    // importantly this means we do not save invalid data as a default value for any field
    if (validationSchema.isValidSync(currentStrategy)) {
      updateStrategy({ ...currentStrategy, ...values });
    }
  };
  return (
    <FormProvider
      initialValues={currentStrategy}
      validationSchema={validationSchema}
      onSubmit={handleSubmit}
      enableReinitialize
    >
      <Form onSubmit={e => e.preventDefault()}>
        <Stack spacing="xl">{children}</Stack>
      </Form>
    </FormProvider>
  );
};

export const PositiveNumberInput = ({
  fieldName,
  handleSubmit,
}: {
  fieldName: string;
  handleSubmit: (values: Partial<TTLStrategy>) => void;
}) => {
  // NOTE: Known tiny bug: on Firefox, if you type invalid input, the error
  // message will be "Required field" instead of "must be a positive number".
  return (
    <FormTextInput
      onChange={e => {
        handleSubmit({
          [fieldName]: Number(e.target.value.trim() || null),
        });
      }}
      name={fieldName}
      type="number"
      min={1}
      styles={{ input: { maxWidth: "5rem" } }}
      autoComplete="off"
    />
  );
};

// export const StrategyStringInput = ({
//   fieldName,
//   handleSubmit,
// }: {
//   fieldName: string;
//   handleSubmit: (values: Partial<ScheduleStrategy>) => void;
// }) => {
//   // NOTE: Known tiny bug: on Firefox, if you type invalid input, the error
//   // message will be "Required field" instead of "must be a positive number".
//   return (
//     <FormTextInput
//       onChange={e => {
//         handleSubmit({
//           [fieldName]: e.target.value.trim() || null,
//         });
//       }}
//       name={fieldName}
//       styles={{ input: { maxWidth: "10rem" } }}
//     />
//   );
// };

// export const CronInput = ({
//   initialValue,
//   handleSubmit,
// }: {
//   initialValue: string;
//   handleSubmit: (values: Partial<ScheduleStrategy>) => void;
// }) => {
//   const [value, setValue] = useState(initialValue);
//   // TODO: Does this need to be a controlled component?
//   return (
//     <CronExpressionInput
//       value={value}
//       onChange={setValue}
//       onBlurChange={value => {
//         handleSubmit({
//           schedule: value.trim(),
//         });
//       }}
//     />
//   );
// };
