import { LindormError } from "@lindorm/errors";
import { QUEUE_JOB_TOPIC } from "../../../constants/private";
import { IJob } from "../../../interfaces";
import { PylonJob } from "../../../messages";
import { PylonMessageQueueOptions, PylonSubscribeOptions } from "../../../types";

export const createQueueSubscription = (
  options: PylonMessageQueueOptions,
): PylonSubscribeOptions => ({
  target: PylonJob,
  topic: QUEUE_JOB_TOPIC,
  callback: async (message: IJob): Promise<void> => {
    const handler = options.handlers[message.event];
    if (!handler) {
      throw new LindormError("Queue handler not found", { debug: { message } });
    }
    await handler(message);
  },
});
