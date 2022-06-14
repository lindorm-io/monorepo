import { ControllerResponse } from "@lindorm-io/koa";
import { LoginSessionAttributes } from "../../entity";
import { ServerKoaController } from "../../types";

type ResponseBody = Partial<LoginSessionAttributes>;

export const getLoginInfoController: ServerKoaController = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    entity: { loginSession },
  } = ctx;

  return {
    body: {
      authenticationSessionId: loginSession.authenticationSessionId,
      codeVerifier: loginSession.codeVerifier,
      expires: loginSession.expires,
    },
  };
};
