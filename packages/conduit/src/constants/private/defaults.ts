import { RetryConfig, RetryStrategy } from "@lindorm/retry";
import { ConduitResponse } from "../../types";

export const CONDUIT_RESPONSE: ConduitResponse = {
  data: {},
  headers: {},
  status: -1,
  statusText: "",
};

export const RETRY_CONFIG: RetryConfig = {
  maxAttempts: 5,
  strategy: RetryStrategy.Exponential,
  timeout: 250,
  timeoutMax: 10000,
};

export const TIMEOUT = 30000;
