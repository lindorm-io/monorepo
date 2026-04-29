import type { ReadableTime } from "@lindorm/date";
import type {
  LindormWorkerCallback,
  LindormWorkerListenerConfig,
} from "../../types/index.js";

export const CALLBACK: LindormWorkerCallback = async (ctx) => {
  ctx.logger.debug("Hello world");
};

export const INTERVAL: ReadableTime = "2y";

export const LISTENERS: Array<LindormWorkerListenerConfig> = [
  { event: "start", listener: () => {} },
  { event: "stop", listener: () => {} },
];
