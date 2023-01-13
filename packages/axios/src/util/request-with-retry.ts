import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { RetryCallback } from "../types";
import { calculateRetry, RetryOptions, sleep } from "@lindorm-io/retry";

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
