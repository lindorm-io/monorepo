import { ServerError } from "@lindorm/errors";
import { IIrisSource } from "@lindorm/iris";
import { PylonCommonContext } from "../../types";

export const resolveIris = (
  ctx: PylonCommonContext,
  override?: IIrisSource,
): IIrisSource => {
  if (override) {
    return override.clone({ logger: ctx.logger });
  }
  if (ctx.iris) {
    return ctx.iris;
  }
  throw new ServerError("IrisSource is not configured");
};
