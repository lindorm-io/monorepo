import type { RetryConfig } from "@lindorm/retry";
import type { ConduitResponse } from "../../types/index.js";

export const CONDUIT_RESPONSE: ConduitResponse = {
  data: {},
  headers: {},
  status: -1,
  statusText: "",
};

export const REPLACE_URL = "https://lindorm.temporary.replace.url" as const;

export const RETRY_CONFIG: RetryConfig = {
  maxAttempts: 5,
  strategy: "exponential",
  timeout: 250,
  timeoutMax: 10000,
};

export const TIMEOUT = 30000;
