import Joi from "joi";
import { AuthenticationMethod } from "../../enum";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID, SessionStatus } from "../../common";
import { ServerKoaController } from "../../types";
import { argon } from "../../instance";
import { calculatePrioritizedMethod } from "../../util";
import { randomString } from "@lindorm-io/core";

interface RequestData {
  id: string;
}

interface CodeResponseBody {
  code: string;
}

interface PendingResponseBody {
  allowedMethods: Array<AuthenticationMethod>;
  emailHint: string | null;
  expires: Date;
  phoneHint: string | null;
  prioritizedMethod: AuthenticationMethod;
  requestedMethods: Array<AuthenticationMethod>;
  status: SessionStatus;
}

type ResponseBody = CodeResponseBody | PendingResponseBody;

export const getAuthenticationSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
  })
  .required();

export const getAuthenticationController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    cache: { authenticationSessionCache },
    entity: { authenticationSession },
  } = ctx;

  if (
    ![SessionStatus.PENDING, SessionStatus.CONFIRMED, SessionStatus.REJECTED].includes(
      authenticationSession.status,
    )
  ) {
    throw new ClientError("Invalid Session Status");
  }

  if (authenticationSession.status === SessionStatus.CONFIRMED) {
    const code = randomString(64);

    authenticationSession.code = await argon.encrypt(code);
    authenticationSession.status = SessionStatus.CODE;

    await authenticationSessionCache.update(authenticationSession);

    return { body: { code } };
  }

  return {
    body: {
      allowedMethods: authenticationSession.allowedMethods,
      emailHint: authenticationSession.emailHint,
      expires: authenticationSession.expires,
      phoneHint: authenticationSession.phoneHint,
      prioritizedMethod: calculatePrioritizedMethod(authenticationSession),
      requestedMethods: authenticationSession.requestedMethods,
      status: authenticationSession.status,
    },
  };
};
