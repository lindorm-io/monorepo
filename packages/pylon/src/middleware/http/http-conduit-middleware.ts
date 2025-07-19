import {
  Conduit,
  ConduitOptions,
  conduitChangeResponseDataMiddleware,
  conduitCorrelationMiddleware,
  conduitSessionMiddleware,
} from "@lindorm/conduit";
import { ServerError } from "@lindorm/errors";
import { isArray } from "@lindorm/is";
import { PylonHttpContext, PylonHttpMiddleware } from "../../types";

type Options = Omit<ConduitOptions, "alias" | "baseUrl" | "logger"> & {
  alias: string;
  baseUrl: string;
};

export const createHttpConduitMiddleware = <
  C extends PylonHttpContext = PylonHttpContext,
>(
  conduitOptions: Options | Array<Options>,
): PylonHttpMiddleware<C> => {
  const array = isArray(conduitOptions) ? conduitOptions : [conduitOptions];

  for (const options of array) {
    if (options.alias) continue;

    throw new ServerError("Alias is required for axios middleware", {
      debug: { options },
    });
  }

  return async function httpConduitMiddleware(ctx, next): Promise<void> {
    for (const options of array) {
      ctx.conduits[options.alias] = new Conduit({
        ...options,
        middleware: [
          conduitCorrelationMiddleware(ctx.state.metadata.correlationId),
          ...(ctx.state.metadata.sessionId
            ? [conduitSessionMiddleware(ctx.state.metadata.sessionId)]
            : []),
          conduitChangeResponseDataMiddleware("camel"),
          ...(options.middleware ?? []),
        ],
        logger: ctx.logger,
      });
    }

    await next();
  };
};
