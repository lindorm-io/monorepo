import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { RetryCallback, RetryOptions } from "../types";
import { calculateRetry, sleep } from "@lindorm-io/core";

export const requestWithRetry = async (
  config: AxiosRequestConfig,
  options: RetryOptions,
  retryCallback: RetryCallback,
  attempt = 1,
): Promise<AxiosResponse> => {
  try {
    return await axios.request(config);
  } catch (err: any) {
    if (!retryCallback(err, attempt, options)) {
      throw err;
    }

    const timeout = calculateRetry(attempt, options);

    await sleep(timeout);

    return requestWithRetry(config, options, retryCallback, attempt + 1);
  }
};
