import { ChangeCase } from "@lindorm/case";
import {
  Conduit,
  ConduitOptions,
  conduitChangeResponseDataMiddleware,
  conduitCorrelationMiddleware,
} from "@lindorm/conduit";
import { ServerError } from "@lindorm/errors";
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
  const array = Array.isArray(conduitOptions) ? conduitOptions : [conduitOptions];

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
          conduitCorrelationMiddleware(ctx.metadata.correlationId),
          conduitChangeResponseDataMiddleware(ChangeCase.Camel),
          ...(options.middleware ?? []),
        ],
        logger: ctx.logger,
      });
    }

    await next();
  };
};