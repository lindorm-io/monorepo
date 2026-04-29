import { Aegis } from "@lindorm/aegis";
import type { IAmphora } from "@lindorm/amphora";
import { Conduit } from "@lindorm/conduit";
import type { Middleware } from "@lindorm/middleware";
import type { PylonCommonContext } from "../../types/index.js";

export const createCommonContextInitialisationMiddleware = <C extends PylonCommonContext>(
  amphora: IAmphora,
): Middleware<C> => {
  return async function commonContextInitialisationMiddleware(ctx, next) {
    ctx.amphora = amphora;

    ctx.aegis = new Aegis({
      amphora: ctx.amphora,
      logger: ctx.logger,
    });

    ctx.conduits = {
      conduit: new Conduit(),
    };

    ctx.entities = {};

    await next();
  };
};
