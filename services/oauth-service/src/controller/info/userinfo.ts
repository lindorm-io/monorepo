import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { IdentityServiceClaims } from "../../common";
import { getIdentityUserinfo } from "../../handler";

export const userinfoController: ServerKoaController = async (
  ctx,
): ControllerResponse<Partial<IdentityServiceClaims>> => {
  const {
    token: {
      bearerToken: { subject, scopes },
    },
  } = ctx;

  const { claims } = await getIdentityUserinfo(ctx, subject, scopes);

  return { body: claims };
};
