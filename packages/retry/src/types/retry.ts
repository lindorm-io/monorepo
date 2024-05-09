import { Optional } from "@lindorm/types";
import { RetryStrategy } from "../enums";

export type RetryConfig = {
  strategy: RetryStrategy;
  timeout: number;
  timeoutMax: number;
};

export type RetryOptions = Optional<RetryConfig, "strategy" | "timeout" | "timeoutMax">;
