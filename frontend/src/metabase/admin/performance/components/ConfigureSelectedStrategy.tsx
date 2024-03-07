// import CronExpressionInput from "metabase/admin/settings/components/widgets/ModelCachingScheduleWidget/CronExpressionInput";
import { FormTextInput } from "metabase/forms";

export const PositiveNumberInput = ({ fieldName }: { fieldName: string }) => {
  // NOTE: Known bug: on Firefox, if you type invalid input, the error
  // message will be "Required field" instead of "must be a positive number".
  return (
    <FormTextInput
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
