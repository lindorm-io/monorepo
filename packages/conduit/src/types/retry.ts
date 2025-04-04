import { RetryConfig } from "@lindorm/retry";
import { ConduitError } from "../errors";

export type RetryCallback = (
  err: ConduitError,
  attempt: number,
  config: RetryConfig,
) => boolean;
