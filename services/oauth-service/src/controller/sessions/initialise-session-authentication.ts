import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_PKCE_METHOD } from "../../constant";
import { PKCEMethod } from "@lindorm-io/core";
import { ServerKoaController } from "../../types";
import { configuration } from "../../server/configuration";
import { generateAxiosBearerAuthMiddleware } from "../../handler";
import { uniq } from "lodash";
import {
  ClientPermission,
  InitialiseAuthenticationRequestData,
  InitialiseAuthenticationResponseBody,
  JOI_JWT,
  LevelOfAssurance,
} from "../../common";

interface RequestData {
  codeChallenge: string;
  codeChallengeMethod: PKCEMethod;
  country?: string;
  idTokenHint?: string;
}

interface ResponseBody {
  authenticationSessionId: string;
}

export const initialiseSessionAuthenticationSchema = Joi.object<RequestData>()
  .keys({
    codeChallenge: Joi.string().required(),
    codeChallengeMethod: JOI_PKCE_METHOD.required(),
    country: Joi.string().lowercase().length(2).optional(),
    idTokenHint: JOI_JWT.optional(),
  })
  .required();

export const initialiseSessionAuthenticationController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    axios: { authenticationClient },
    data: { codeChallenge, codeChallengeMethod, country },
    token: { bearerToken, idToken },
  } = ctx;

  const body: InitialiseAuthenticationRequestData = {
    clientId: configuration.oauth.client_id,
    codeChallenge,
    codeMethod: codeChallengeMethod,
    country,
    identityId: bearerToken.subject,
    levelOfAssurance: bearerToken.levelOfAssurance as LevelOfAssurance,
    loginHint: uniq([
      ...(idToken?.claims?.email ? [idToken.claims.email] : []),
      ...(idToken?.claims?.phoneNumber ? [idToken.claims.phoneNumber] : []),
      ...(idToken?.claims?.username ? [idToken.claims.username] : []),
    ]),
    methods: idToken?.authMethodsReference,
    nonce: bearerToken.nonce,
  };

  const { data } = await authenticationClient.post<InitialiseAuthenticationResponseBody>(
    "/internal/authentication",
    {
      data: body,
      middleware: [
        generateAxiosBearerAuthMiddleware(ctx, [ClientPermission.AUTHENTICATION_CONFIDENTIAL]),
      ],
    },
  );

  return { body: { authenticationSessionId: data.id } };
};
