import { AxiosError } from "axios";
import { RetryOptions } from "@lindorm-io/retry";

export type RetryCallback = (
  err: AxiosError,
  attempt: number,
  retryOptions: Partial<RetryOptions>,
) => boolean;
