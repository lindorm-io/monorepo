import { AxiosBasicCredentials, AxiosResponse } from "axios";
import { RetryOptions } from "@lindorm-io/retry";

export const DEFAULT_AUTH_OPTIONS: AxiosBasicCredentials = {
  username: undefined,
  password: undefined,
};

export const DEFAULT_AXIOS_RESPONSE: AxiosResponse = {
  config: {},
  data: {},
  headers: {},
  request: {},
  status: -1,
  statusText: "",
};

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maximumAttempts: 5,
  maximumMilliseconds: 30000,
  milliseconds: 500,
  strategy: "exponential",
};

export const DEFAULT_TIMEOUT_OPTIONS = 30000;
