import { resolveIris } from "#internal/utils/resolve-iris";
import { camelCase } from "@lindorm/case";
import { IIrisSource, IMessage } from "@lindorm/iris";
import { Constructor, Dict } from "@lindorm/types";
import { PylonContext, PylonMiddleware } from "../../types";

export const createPublisherMiddleware = <C extends PylonContext = PylonContext>(
  messages: Array<Constructor<IMessage>>,
  iris?: IIrisSource,
): PylonMiddleware<C> =>
  async function publisherMiddleware(ctx, next) {
    const source = resolveIris(ctx, iris);
    const obj: Dict = {};

    for (const message of messages) {
      let cached: any;
      Object.defineProperty(obj, camelCase(message.name), {
        get: () => (cached ??= source.publisher(message)),
        enumerable: true,
        configurable: true,
      });
    }

    ctx.publishers = obj;

    await next();
  };
