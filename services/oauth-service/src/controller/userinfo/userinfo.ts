import { ControllerResponse } from "@lindorm-io/koa";
import { LindormClaims } from "@lindorm-io/common-types";
import { ServerKoaController } from "../../types";
import { convertOpaqueTokenToJwt, getIdentityUserinfo } from "../../handler";

export const userinfoController: ServerKoaController = async (
  ctx,
): ControllerResponse<Partial<LindormClaims>> => {
  const {
    entity: { clientSession, opaqueToken },
  } = ctx;

  const { token } = convertOpaqueTokenToJwt(ctx, clientSession, opaqueToken);

  const body = await getIdentityUserinfo(ctx, token);

  return { body };
};
