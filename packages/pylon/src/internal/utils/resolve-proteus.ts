import { ServerError } from "@lindorm/errors";
import { IProteusSource } from "@lindorm/proteus";
import { PylonCommonContext } from "../../types";

export const resolveProteus = (
  ctx: PylonCommonContext,
  override?: IProteusSource,
): IProteusSource => {
  if (override) {
    return override.clone({ logger: ctx.logger });
  }
  if (ctx.proteus) {
    return ctx.proteus;
  }
  throw new ServerError("ProteusSource is not configured");
};
