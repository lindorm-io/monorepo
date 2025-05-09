import { ReadableTime } from "@lindorm/date";
import { RetryOptions } from "@lindorm/retry";
import { LindormWorkerCallback } from "./context";

export type LindormWorkerConfig = {
  alias: string;
  callback: LindormWorkerCallback;
  interval: ReadableTime | number | undefined;
  retry: RetryOptions | undefined;
};

export type LindormWorkerScannerInput = Array<LindormWorkerConfig | string>;

export type LindormWorkerScannerOutput = Array<LindormWorkerConfig>;
