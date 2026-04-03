import { ReadableTime } from "@lindorm/date";
import { LindormWorkerCallback, LindormWorkerListenerConfig } from "../../types";

export const CALLBACK: LindormWorkerCallback = async (ctx) => {
  ctx.logger.debug("Hello world");
};

export const INTERVAL: ReadableTime = "2y";

export const LISTENERS: Array<LindormWorkerListenerConfig> = [
  { event: "start", listener: () => {} },
  { event: "stop", listener: () => {} },
];
