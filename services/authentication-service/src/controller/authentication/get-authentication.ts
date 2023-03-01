import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { argon } from "../../instance";
import { generateClientConfig } from "../../util";
import { randomString } from "@lindorm-io/random";
import {
  GetAuthenticationRequestParams,
  GetAuthenticationResponse,
  SessionStatus,
} from "@lindorm-io/common-types";

type RequestData = GetAuthenticationRequestParams;

type ResponseBody = GetAuthenticationResponse;

export const getAuthenticationSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const getAuthenticationController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    axios: { oidcClient },
    cache: { authenticationSessionCache },
    entity: { authenticationSession },
  } = ctx;

  if (
    authenticationSession.status !== SessionStatus.CONFIRMED &&
    authenticationSession.status !== SessionStatus.PENDING &&
    authenticationSession.status !== SessionStatus.REJECTED
  ) {
    throw new ClientError("Invalid Session Status");
  }

  if (authenticationSession.status === SessionStatus.CONFIRMED) {
    const code = randomString(64);

    authenticationSession.code = await argon.encrypt(code);
    authenticationSession.status = SessionStatus.CODE;

    await authenticationSessionCache.update(authenticationSession);

    return { body: { code, mode: authenticationSession.mode } };
  }

  const clientConfig = generateClientConfig(authenticationSession);

  let oidcProviders = [];

  if (
    !authenticationSession.confirmedOidcProvider &&
    !authenticationSession.confirmedOidcLevel &&
    !authenticationSession.confirmedStrategies.length
  ) {
    const {
      data: { providers },
    } = await oidcClient.get("/providers");

    oidcProviders = providers;
  }

  return {
    body: {
      config: clientConfig,
      emailHint: authenticationSession.emailHint,
      expires: authenticationSession.expires,
      mode: authenticationSession.mode,
      oidcProviders,
      phoneHint: authenticationSession.phoneHint,
      status: authenticationSession.status,
    },
  };
};
