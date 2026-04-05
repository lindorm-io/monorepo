import { ServerError } from "@lindorm/errors";
import { IIrisSession, IIrisSource } from "@lindorm/iris";
import { PylonCommonContext } from "../../types";

export const resolveIris = (
  ctx: PylonCommonContext,
  override?: IIrisSource,
): IIrisSession => {
  if (override) {
    return override.session({ logger: ctx.logger, context: ctx });
  }
  if (ctx.iris) {
    return ctx.iris;
  }
  throw new ServerError("IrisSource is not configured");
};
