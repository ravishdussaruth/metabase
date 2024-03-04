import { t } from "ttag";
import * as Yup from "yup";

export const unitOfTimeRegex = /hours|minutes|seconds|days/;

const positiveInteger = Yup.number()
  .positive(t`The minimum query duration must be a positive number.`)
  .integer(t`The minimum query duration must be an integer.`);

const requiredPositiveInteger = positiveInteger.required(t`Required field`);

export const isValidPositiveInteger = (value: unknown) =>
  positiveInteger.isValidSync(value);

export const ttlStrategyValidationSchema = Yup.object({
  min_duration: requiredPositiveInteger,
  multiplier: requiredPositiveInteger,
});

export const durationStrategyValidationSchema = Yup.object({
  duration: requiredPositiveInteger,
  unit: Yup.string().matches(unitOfTimeRegex),
});

// TODO: These schemas are to be added in later

// export const scheduleStrategyValidationSchema = Yup.object({
//   // TODO: Enforce format?
//   schedule: Yup.string(),
// });

// export const queryStrategyValidationSchema = Yup.object({
//   field_id: requiredPositiveInteger,
//   aggregation: Yup.string().matches(/max|count/),
//   schedule: Yup.string(),
// });
