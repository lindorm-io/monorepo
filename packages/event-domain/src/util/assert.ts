import { LindormError } from "@lindorm-io/errors";
import { ValidationResult } from "joi";
import { camelCase } from "lodash";

export const assertSchema = (result?: ValidationResult): void => {
  if (!result?.error) return;

  throw new LindormError("Schema Validation Error", {
    error: result.error,
  });
};

export const assertSchemaAsync = async (promise: Promise<any>): Promise<void> => {
  try {
    await promise;
  } catch (err) {
    console.error(err);
    throw new LindormError("Schema Validation Error", {
      error: err,
    });
  }
};

export const assertCamelCase = (input: string): void => {
  if (camelCase(input) === input) return;

  throw new LindormError(`${input} is not in camelCase`);
};
