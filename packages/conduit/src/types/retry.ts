import type { LindormError } from "@lindorm/errors";
import type { RetryConfig } from "@lindorm/retry";

export type RetryCallback = (
  err: LindormError,
  attempt: number,
  config: RetryConfig,
) => boolean;

export type OnRetryCallback = (
  err: LindormError,
  attempt: number,
  config: RetryConfig,
) => void;
