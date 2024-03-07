import { t } from "ttag";
import * as Yup from "yup";

import { Strategies, isValidStrategyName } from "./types";

export const unitOfTimeRegex = /hours|minutes|seconds|days/;

const positiveInteger = Yup.number()
  .positive(t`The minimum query duration must be a positive number.`)
  .integer(t`The minimum query duration must be an integer.`);

export const isValidPositiveInteger = (value: unknown) =>
  positiveInteger.isValidSync(value);

export const doNotCacheStrategyValidationSchema = Yup.object({});

export const ttlStrategyValidationSchema = Yup.object({
  min_duration: positiveInteger.required(t`Required field: min_duration`),
  multiplier: positiveInteger.required(t`Required field: multiplier`),
});

export const durationStrategyValidationSchema = Yup.object({
  duration: positiveInteger.required(t`Required field: duration`),
  unit: Yup.string().matches(unitOfTimeRegex),
});

export const strategyValidationSchema = Yup.object().test(
  "strategy-validation",
  "The object must match one of the strategy validation schemas",
  function (value) {
    const { type } = value as unknown as { type: string }; // TODO: fix
    if (!isValidStrategyName(type)) {
      return this.createError({
        message: `"${type}" is not a valid strategy name`,
        path: "type",
      });
    }
    const schema = Strategies[type].validateWith;
    try {
      schema.validateSync(value);
      return true;
    } catch (error: unknown) {
      if (error instanceof Yup.ValidationError) {
        return this.createError({
          message: error.message,
          path: error.path,
        });
      } else {
        console.error("Unhandled error:", error);
        return false;
      }
    }
  },
) as Yup.AnySchema;

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
