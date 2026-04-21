import type { RetryConfig } from "@lindorm/retry";
import { ConduitError } from "../errors/index.js";

export type RetryCallback = (
  err: ConduitError,
  attempt: number,
  config: RetryConfig,
) => boolean;

export type OnRetryCallback = (
  err: ConduitError,
  attempt: number,
  config: RetryConfig,
) => void;
