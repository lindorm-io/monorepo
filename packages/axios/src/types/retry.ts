import { AxiosError } from "axios";
import { RetryOptions } from "@lindorm-io/retry";

export type RetryCallback = (
  err: AxiosError,
  attempt: number,
  retryOptions: RetryOptions,
) => boolean;
