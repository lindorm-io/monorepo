import { RetryConfig, RetryOptions } from "@lindorm/retry";
import { Optional } from "@lindorm/types";
import { ConduitError } from "../errors";

type ExtendedRetryConfig = {
  maximumAttempts: number;
};

type ExtendedRetryOptions = Optional<ExtendedRetryConfig, "maximumAttempts">;

export type ConduitRetryConfig = RetryConfig & ExtendedRetryConfig;

export type ConduitRetryOptions = RetryOptions & ExtendedRetryOptions;

export type RetryCallback = (
  err: ConduitError,
  attempt: number,
  retryOptions: ConduitRetryOptions,
) => boolean;
