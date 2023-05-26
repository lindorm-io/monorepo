import { LindormClaims } from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import { convertOpaqueTokenToJwt, getIdentityUserinfo } from "../../handler";
import { ServerKoaController } from "../../types";

export const userinfoController: ServerKoaController = async (
  ctx,
): ControllerResponse<Partial<LindormClaims>> => {
  const {
    entity: { clientSession, opaqueToken },
    token: { bearerToken },
  } = ctx;

  const { token } = convertOpaqueTokenToJwt(ctx, clientSession, opaqueToken, bearerToken?.token);

  const body = await getIdentityUserinfo(ctx, token);

  return { body };
};
