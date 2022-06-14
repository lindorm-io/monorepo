import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { LoginSessionAttributes } from "../../entity";
import { ServerKoaController } from "../../types";
import { SessionStatus } from "../../common";

type ResponseBody = Partial<LoginSessionAttributes>;

export const acknowledgeLoginController: ServerKoaController = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    cache: { loginSessionCache },
    entity: { loginSession },
  } = ctx;

  if (loginSession.status !== SessionStatus.PENDING) {
    throw new ClientError("Invalid Session Status");
  }

  loginSession.status = SessionStatus.ACKNOWLEDGED;

  await loginSessionCache.update(loginSession);

  return {
    body: {
      authenticationSessionId: loginSession.authenticationSessionId,
      codeVerifier: loginSession.codeVerifier,
      expires: loginSession.expires,
    },
  };
};
