import Joi from "joi";
import { AuthenticationMode } from "../../enum";
import { ClientConfig, ServerKoaController } from "../../types";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID, SessionStatus } from "../../common";
import { argon } from "../../instance";
import { generateClientConfig } from "../../util";
import { randomString } from "@lindorm-io/random";

type RequestData = {
  id: string;
};

type CodeResponseBody = {
  code: string;
  mode: AuthenticationMode;
};

type PendingResponseBody = {
  clientConfig: Array<ClientConfig>;
  emailHint: string | null;
  expires: Date;
  mode: AuthenticationMode;
  oidcProviders: Array<string>;
  phoneHint: string | null;
  status: SessionStatus;
};

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
    axios: { oidcClient },
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
      clientConfig,
      emailHint: authenticationSession.emailHint,
      expires: authenticationSession.expires,
      mode: authenticationSession.mode,
      oidcProviders,
      phoneHint: authenticationSession.phoneHint,
      status: authenticationSession.status,
    },
  };
};
