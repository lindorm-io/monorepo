import { ReadableTime } from "@lindorm/date";
import { LindormWorkerCallback, LindormWorkerListenerConfig } from "../../types";

export const callback: LindormWorkerCallback = async (ctx) => {
  ctx.logger.debug("Hello world");
};

export const interval: ReadableTime = "2y";

export const listeners: Array<LindormWorkerListenerConfig> = [
  { event: "start", listener: () => {} },
  { event: "stop", listener: () => {} },
];
