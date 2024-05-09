import { RetryStrategy } from "@lindorm/retry";
import { ConduitResponse, ConduitRetryConfig } from "../../types";

export const _CONDUIT_RESPONSE: ConduitResponse = {
  data: {},
  headers: {},
  status: -1,
  statusText: "",
};

export const _RETRY_CONFIG: ConduitRetryConfig = {
  maximumAttempts: 5,
  strategy: RetryStrategy.Exponential,
  timeout: 250,
  timeoutMax: 10000,
};

export const _TIMEOUT = 30000;
