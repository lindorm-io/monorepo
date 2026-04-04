import { ServerError } from "@lindorm/errors";
import { Dict } from "@lindorm/types";
import { PylonContext, PylonMiddleware } from "../../types";

type UseScopeOptions = {
  params: (ctx: PylonContext) => Dict<unknown>;
};

export const useScope = (options: UseScopeOptions): PylonMiddleware => {
  return async function useScopeMiddleware(ctx: PylonContext, next) {
    if (!ctx.proteus) {
      throw new ServerError("useScope requires ProteusSource on context");
    }

    const params = options.params(ctx);
    ctx.proteus.setFilterParams("__scope", params);

    await next();
  };
};
