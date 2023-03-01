import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { LindormClaims } from "@lindorm-io/common-types";
import { getIdentityUserinfo } from "../../handler";

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
