import { ServerError } from "@lindorm/errors";
import type { IIrisSession, IIrisSource } from "@lindorm/iris";
import type { PylonCommonContext } from "../../types/index.js";
import { buildHookMeta } from "./build-hook-meta.js";
import { resolveActor } from "./resolve-actor.js";

export const resolveIris = (
  ctx: PylonCommonContext,
  override?: IIrisSource,
): IIrisSession => {
  if (override) {
    return override.session({
      logger: ctx.logger,
      meta: buildHookMeta(ctx, resolveActor(ctx)),
    });
  }
  if (ctx.iris) {
    return ctx.iris;
  }
  throw new ServerError("IrisSource is not configured");
};
