import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { generateClientConfig } from "../../util";
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
    entity: { authenticationSession },
  } = ctx;

  if (
    ![SessionStatus.CODE, SessionStatus.CONFIRMED, SessionStatus.PENDING].includes(
      authenticationSession.status,
    )
  ) {
    throw new ClientError("Invalid Session Status", {
      debug: { status: authenticationSession.status },
    });
  }

  if ([SessionStatus.CODE, SessionStatus.CONFIRMED].includes(authenticationSession.status)) {
    return {
      body: {
        config: [],
        expires: authenticationSession.expires.toISOString(),
        mode: authenticationSession.mode,
        oidcProviders: [],
        status: authenticationSession.status,
      },
    };
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
      expires: authenticationSession.expires.toISOString(),
      mode: authenticationSession.mode,
      oidcProviders,
      status: authenticationSession.status,
    },
  };
};
