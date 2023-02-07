import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { getIdentityUserinfo } from "../../handler";
import { LindormClaims } from "@lindorm-io/common-types";

export const userinfoController: ServerKoaController = async (
  ctx,
): ControllerResponse<Partial<LindormClaims>> => {
  const {
    token: {
      bearerToken: { token },
    },
  } = ctx;

  const body = await getIdentityUserinfo(ctx, token);

  return { body };
};
