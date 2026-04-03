import {
  Conduit,
  ConduitMiddleware,
  ConduitOptions,
  conduitChangeResponseDataMiddleware,
  conduitCorrelationMiddleware,
  conduitSessionMiddleware,
} from "@lindorm/conduit";
import { ServerError } from "@lindorm/errors";
import { isArray } from "@lindorm/is";
import { PylonContext, PylonMiddleware } from "../../types";

type Options = Omit<ConduitOptions, "alias" | "baseUrl" | "logger"> & {
  alias: string;
  baseUrl: string;
};

export const createConduitMiddleware = <C extends PylonContext = PylonContext>(
  conduitOptions: Options | Array<Options>,
): PylonMiddleware<C> => {
  const array = isArray(conduitOptions) ? conduitOptions : [conduitOptions];

  for (const options of array) {
    if (options.alias) continue;

    throw new ServerError("Alias is required for conduit middleware", {
      debug: { options },
    });
  }

  return async function conduitMiddleware(ctx, next): Promise<void> {
    for (const options of array) {
      const extra: Array<ConduitMiddleware> = [];

      if (ctx.state.metadata.correlationId) {
        extra.push(conduitCorrelationMiddleware(ctx.state.metadata.correlationId));
      }

      const metadata = ctx.state.metadata as Record<string, any>;
      if (metadata.sessionId) {
        extra.push(conduitSessionMiddleware(metadata.sessionId));
      }

      ctx.conduits[options.alias] = new Conduit({
        ...options,
        middleware: [
          ...extra,
          conduitChangeResponseDataMiddleware("camel"),
          ...(options.middleware ?? []),
        ],
        logger: ctx.logger,
      });
    }

    await next();
  };
};
