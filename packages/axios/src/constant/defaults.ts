import { AxiosResponse } from "axios";
import { RetryOptions } from "@lindorm-io/retry";

export const DEFAULT_AXIOS_RESPONSE = {
  config: {},
  data: {},
  headers: {},
  request: {},
  status: -1,
  statusText: "",
} as AxiosResponse;

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maximumAttempts: 5,
  maximumMilliseconds: 30000,
  milliseconds: 500,
  strategy: "exponential",
};

export const DEFAULT_TIMEOUT = 30000;
