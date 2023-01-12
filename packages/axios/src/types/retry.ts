import { RetryStrategy } from "@lindorm-io/retry";
import { AxiosError } from "axios";

export type RetryOptions = {
  maximumAttempts?: number;
  maximumMilliseconds?: number;
  milliseconds?: number;
  strategy?: RetryStrategy;
};

export type RetryCallback = (
  err: AxiosError,
  attempt: number,
  retryOptions: RetryOptions,
) => boolean;
