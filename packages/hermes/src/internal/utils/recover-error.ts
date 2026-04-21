import { snakeCase } from "@lindorm/case";
import type { Constructor } from "@lindorm/types";
import {
  AggregateAlreadyCreatedError,
  AggregateDestroyedError,
  AggregateNotCreatedError,
  AggregateNotDestroyedError,
  ChecksumError,
  CommandSchemaValidationError,
  DomainError,
} from "../../errors/index.js";
import type { HermesErrorMessage } from "../messages/index.js";

type ErrorData = {
  error: { message: string; [key: string]: unknown };
  [key: string]: unknown;
};

const errorConstructorMap = new Map<string, Constructor>([
  [snakeCase(AggregateAlreadyCreatedError.name), AggregateAlreadyCreatedError],
  [snakeCase(AggregateDestroyedError.name), AggregateDestroyedError],
  [snakeCase(AggregateNotCreatedError.name), AggregateNotCreatedError],
  [snakeCase(AggregateNotDestroyedError.name), AggregateNotDestroyedError],
  [snakeCase(CommandSchemaValidationError.name), CommandSchemaValidationError],
  [snakeCase(ChecksumError.name), ChecksumError],
]);

export const recoverError = (message: HermesErrorMessage): DomainError => {
  const data = message.data as ErrorData;
  const ErrorCtor = errorConstructorMap.get(message.name) ?? DomainError;
  const error = new ErrorCtor(data.error?.message ?? "Unknown error");

  if (data.error) {
    for (const [key, value] of Object.entries(data.error)) {
      if (key !== "message") {
        (error as Record<string, unknown>)[key] = value;
      }
    }
  }

  return error as DomainError;
};
