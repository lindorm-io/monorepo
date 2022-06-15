import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_JWT } from "../../common";
import { ServerKoaController } from "../../types";
import { SessionHint } from "../../enum";
import {
  updateBrowserSessionAuthentication,
  updateRefreshSessionAuthentication,
} from "../../handler";

interface RequestData {
  authToken: string;
}

export const updateSessionAuthenticationSchema = Joi.object<RequestData>()
  .keys({
    authToken: JOI_JWT.required(),
  })
  .required();

export const updateSessionAuthenticationController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    token: { authenticationConfirmationToken, bearerToken },
  } = ctx;

  if (bearerToken.sessionHint === SessionHint.BROWSER) {
    return await updateBrowserSessionAuthentication(
      ctx,
      bearerToken.sessionId,
      authenticationConfirmationToken,
    );
  }

  if (bearerToken.sessionHint === SessionHint.REFRESH) {
    return await updateRefreshSessionAuthentication(
      ctx,
      bearerToken.sessionId,
      authenticationConfirmationToken,
    );
  }

  throw new ClientError("Invalid Session Type");
};
