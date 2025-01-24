import { ChangeCase } from "@lindorm/case";
import {
  Conduit,
  ConduitOptions,
  conduitChangeResponseDataMiddleware,
} from "@lindorm/conduit";
import { ServerError } from "@lindorm/errors";
import { isArray } from "@lindorm/is";
import { PylonSocketContext, PylonSocketMiddleware } from "../../types";

type Options = Omit<ConduitOptions, "alias" | "baseUrl" | "logger"> & {
  alias: string;
  baseUrl: string;
};

export const createSocketConduitMiddleware = <
  C extends PylonSocketContext = PylonSocketContext,
>(
  conduitOptions: Options | Array<Options>,
): PylonSocketMiddleware<C> => {
  const array = isArray(conduitOptions) ? conduitOptions : [conduitOptions];

  for (const options of array) {
    if (options.alias) continue;

    throw new ServerError("Alias is required for axios middleware", {
      debug: { options },
    });
  }

  return async function socketConduitMiddleware(ctx, next): Promise<void> {
    for (const options of array) {
      ctx.conduits[options.alias] = new Conduit({
        ...options,
        middleware: [
          // conduitCorrelationMiddleware(socket.metadata.correlationId),
          conduitChangeResponseDataMiddleware(ChangeCase.Camel),
          ...(options.middleware ?? []),
        ],
        logger: ctx.logger,
      });
    }

    await next();
  };
};
