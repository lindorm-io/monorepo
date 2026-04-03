import { ServerError } from "@lindorm/errors";
import { Middleware } from "@lindorm/middleware";
import { Dict, Priority } from "@lindorm/types";
import { PylonJob } from "../../messages";
import { PylonContext, PylonQueueOptions } from "../../types";
import { resolveIris } from "../utils";

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
      ctx.queue = async () => {
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
        const wq = iris.workerQueue(PylonJob);
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
