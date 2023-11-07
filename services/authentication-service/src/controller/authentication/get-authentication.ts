import {
  GetAuthenticationRequestParams,
  GetAuthenticationResponse,
  SessionStatus,
} from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { ServerKoaController } from "../../types";
import { generateClientConfig } from "../../util";

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
    axios: { federationClient },
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
        federationProviders: [],
        status: authenticationSession.status,
      },
    };
  }

  const clientConfig = generateClientConfig(authenticationSession);

  let federationProviders = [];

  if (
    !authenticationSession.confirmedFederationProvider &&
    !authenticationSession.confirmedFederationLevel &&
    !authenticationSession.confirmedStrategies.length
  ) {
    const {
      data: { providers },
    } = await federationClient.get("/providers");

    federationProviders = providers;
  }

  return {
    body: {
      config: clientConfig,
      expires: authenticationSession.expires.toISOString(),
      mode: authenticationSession.mode,
      federationProviders,
      status: authenticationSession.status,
    },
  };
};
