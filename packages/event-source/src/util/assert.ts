import { LindormError } from "@lindorm-io/errors";
import { ValidationResult } from "joi";
import { snakeCase } from "@lindorm-io/case";

export const assertSchema = (result?: ValidationResult): void => {
  if (!result?.error) return;

  throw new LindormError("Schema Validation Error", {
    error: result.error,
  });
};

export const assertSchemaAsync = async (promise: Promise<any>): Promise<void> => {
  try {
    await promise;
  } catch (err: any) {
    throw new LindormError("Schema Validation Error", {
      error: err,
    });
  }
};

export const assertSnakeCase = (input: string): void => {
  if (snakeCase(input) === input) return;

  throw new LindormError(`${input} is not in snakeCase`);
};
