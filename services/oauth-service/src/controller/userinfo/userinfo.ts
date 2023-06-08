import { LindormIdentityClaims } from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import { convertOpaqueTokenToJwt, getIdentityUserinfo } from "../../handler";
import { ServerKoaController } from "../../types";

export const userinfoController: ServerKoaController = async (
  ctx,
): ControllerResponse<Partial<LindormIdentityClaims>> => {
  const {
    entity: { clientSession, opaqueToken },
  } = ctx;

  const { token } = convertOpaqueTokenToJwt(ctx, clientSession, opaqueToken);

  const body = await getIdentityUserinfo(ctx, token);

  return { body };
};
