import { resolveIris } from "../../internal/utils/resolve-iris.js";
import { camelCase } from "@lindorm/case";
import type { IIrisSource, IMessage } from "@lindorm/iris";
import type { Constructor, Dict } from "@lindorm/types";
import { lazyFactory } from "@lindorm/utils";
import type { PylonContext, PylonMiddleware } from "../../types/index.js";

export const createWorkerQueueMiddleware = <C extends PylonContext = PylonContext>(
  messages: Array<Constructor<IMessage>>,
  iris?: IIrisSource,
): PylonMiddleware<C> =>
  async function workerQueueMiddleware(ctx, next) {
    const source = resolveIris(ctx, iris);
    const obj: Dict = {};

    for (const message of messages) {
      lazyFactory(obj, camelCase(message.name), () => source.workerQueue(message));
    }

    ctx.workerQueues = obj;

    await next();
  };
