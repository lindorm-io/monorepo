import { Optional } from "@lindorm/types";
import { RetryStrategy } from "../enums";

export type RetryConfig = {
  maxAttempts: number;
  strategy: RetryStrategy;
  timeout: number;
  timeoutMax: number;
};

export type RetryOptions = Optional<
  RetryConfig,
  "maxAttempts" | "strategy" | "timeout" | "timeoutMax"
>;
