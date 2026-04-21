import { snakeCase } from "@lindorm/case";
import type { HermesErrorMessage } from "../messages";
import {
  AggregateAlreadyCreatedError,
  AggregateDestroyedError,
  AggregateNotCreatedError,
  AggregateNotDestroyedError,
  ChecksumError,
  CommandSchemaValidationError,
  DomainError,
} from "../../errors";
import { recoverError } from "./recover-error";
import { describe, expect, test } from "vitest";

const createErrorMessage = (
  name: string,
  errorData: Record<string, unknown> = {},
): HermesErrorMessage =>
  ({
    name,
    data: {
      error: { message: "test error message", ...errorData },
    },
  }) as unknown as HermesErrorMessage;

describe("recoverError", () => {
  test("should recover AggregateAlreadyCreatedError from error message name", () => {
    const message = createErrorMessage(snakeCase(AggregateAlreadyCreatedError.name));
    const error = recoverError(message);

    expect(error).toBeInstanceOf(AggregateAlreadyCreatedError);
  });

  test("should recover AggregateDestroyedError from error message name", () => {
    const message = createErrorMessage(snakeCase(AggregateDestroyedError.name));
    const error = recoverError(message);

    expect(error).toBeInstanceOf(AggregateDestroyedError);
  });

  test("should recover AggregateNotCreatedError from error message name", () => {
    const message = createErrorMessage(snakeCase(AggregateNotCreatedError.name));
    const error = recoverError(message);

    expect(error).toBeInstanceOf(AggregateNotCreatedError);
  });

  test("should recover AggregateNotDestroyedError from error message name", () => {
    const message = createErrorMessage(snakeCase(AggregateNotDestroyedError.name));
    const error = recoverError(message);

    expect(error).toBeInstanceOf(AggregateNotDestroyedError);
  });

  test("should recover CommandSchemaValidationError from error message name", () => {
    const message = createErrorMessage(snakeCase(CommandSchemaValidationError.name));
    const error = recoverError(message);

    expect(error).toBeInstanceOf(CommandSchemaValidationError);
  });

  test("should recover ChecksumError from error message name", () => {
    const message = createErrorMessage(snakeCase(ChecksumError.name));
    const error = recoverError(message);

    expect(error).toBeInstanceOf(ChecksumError);
  });

  test("should fall back to DomainError for unknown error names", () => {
    const message = createErrorMessage("unknown_error_type");
    const error = recoverError(message);

    expect(error).toBeInstanceOf(DomainError);
    expect(error.message).toBe("test error message");
  });

  test("should copy additional properties from error data", () => {
    const message = createErrorMessage(snakeCase(DomainError.name), {
      code: "TEST_CODE",
      details: { field: "name" },
    });
    const error = recoverError(message);

    expect((error as any).code).toBe("TEST_CODE");
    expect((error as any).details).toMatchSnapshot();
  });

  test("should use default message when error data has no message", () => {
    const message = {
      name: "unknown_error",
      data: { error: {} },
    } as unknown as HermesErrorMessage;

    const error = recoverError(message);

    expect(error.message).toBe("Unknown error");
  });
});
