import { ServerError } from "@lindorm/errors";
import type { Middleware } from "@lindorm/middleware";
import type { Dict, Priority } from "@lindorm/types";
import type { PylonContext, PylonQueueOptions } from "../../types/index.js";
import { resolveIris } from "../utils/resolve-iris.js";

const PRIORITY_MAP: Record<Priority, number> = {
  background: 0,
  low: 1,
  default: 5,
  medium: 6,
  high: 8,
  critical: 10,
};

export const createQueueMiddleware = <C extends PylonContext>(
  options?: PylonQueueOptions,
): Middleware<C> => {
  if (!options?.enabled) {
    return async function disabledQueueMiddleware(ctx, next) {
      ctx.queue = async (): Promise<never> => {
        throw new ServerError("Queue is not enabled");
      };
      await next();
    };
  }

  return async function queueMiddleware(ctx, next) {
    ctx.queue = async (
      event: string,
      payload: Dict = {},
      priority: Priority = "default",
      optional = false,
    ): Promise<void> => {
      try {
        const iris = resolveIris(ctx, options.iris);
        const { Job } = await import("../../messages/Job.js");
        const wq = iris.workerQueue(Job);
        const job = wq.create({
          correlationId: ctx.state.metadata.correlationId,
          event,
          payload,
        });
        await wq.publish(job, { priority: PRIORITY_MAP[priority] });
      } catch (err: any) {
        if (optional) {
          ctx.logger.warn("Failed to handle queue", err);
          return;
        }
        throw err;
      }
    };
    await next();
  };
};
