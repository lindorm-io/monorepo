import { ReadableTime } from "@lindorm/date";
import { LindormWorkerEvent } from "../../enums";
import { LindormWorkerCallback, LindormWorkerListenerConfig } from "../../types";

export const callback: LindormWorkerCallback = async (ctx) => {
  ctx.logger.debug("Hello world");
};

export const interval: ReadableTime = "2y";

export const listeners: Array<LindormWorkerListenerConfig> = [
  { event: LindormWorkerEvent.Start, listener: () => {} },
  { event: LindormWorkerEvent.Stop, listener: () => {} },
];
