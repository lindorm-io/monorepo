import axios, { RawAxiosRequestConfig, AxiosResponse } from "axios";
import { RetryCallback } from "../../types";
import { calculateRetry, RetryOptions, sleep } from "@lindorm-io/retry";

export const requestWithRetry = async (
  config: RawAxiosRequestConfig,
  retryOptions: RetryOptions,
  retryCallback: RetryCallback,
  attempt = 1,
): Promise<AxiosResponse> => {
  try {
    return await axios.request(config);
  } catch (err: any) {
    if (!retryCallback(err, attempt, retryOptions)) {
      throw err;
    }

    const timeout = calculateRetry(attempt, retryOptions);

    await sleep(timeout);

    return requestWithRetry(config, retryOptions, retryCallback, attempt + 1);
  }
};
