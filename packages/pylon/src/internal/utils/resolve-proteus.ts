import { ServerError } from "@lindorm/errors";
import { IProteusSession, IProteusSource } from "@lindorm/proteus";
import { PylonCommonContext } from "../../types";

export const resolveProteus = (
  ctx: PylonCommonContext,
  override?: IProteusSource,
): IProteusSession => {
  if (override) {
    return override.session({ logger: ctx.logger, context: ctx });
  }
  if (ctx.proteus) {
    return ctx.proteus;
  }
  throw new ServerError("ProteusSource is not configured");
};
