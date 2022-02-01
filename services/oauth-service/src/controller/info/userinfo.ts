import { Context } from "../../types";
import { Controller, ControllerResponse } from "@lindorm-io/koa";
import { IdentityServiceClaims } from "../../common";
import { getIdentityUserinfo } from "../../handler";

export const userinfoController: Controller<Context> = async (
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
