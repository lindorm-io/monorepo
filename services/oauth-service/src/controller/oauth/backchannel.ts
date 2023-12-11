import { axiosBearerAuthMiddleware } from "@lindorm-io/axios";
import {
  InitialiseBackchannelAuthQuery,
  OpenIdBackchannelAuthenticationRequestBody,
  OpenIdBackchannelAuthenticationResponse,
} from "@lindorm-io/common-types";
import { uniqArray } from "@lindorm-io/core";
import { ClientError } from "@lindorm-io/errors";
import { expiryObject } from "@lindorm-io/expiry";
import { ControllerResponse } from "@lindorm-io/koa";
import { ms } from "@lindorm-io/readable-time";
import Joi from "joi";
import { BackchannelSession } from "../../entity";
import { generateServerCredentialsJwt } from "../../handler";
import { configuration } from "../../server/configuration";
import { ServerKoaController } from "../../types";
import { extractAcrValues } from "../../util";

type RequestData = OpenIdBackchannelAuthenticationRequestBody;

type ResponseData = OpenIdBackchannelAuthenticationResponse;

export const oauthBackchannelSchema = Joi.object<RequestData>()
  .keys({
    acrValues: Joi.string(),
    bindingMessage: Joi.string(),
    clientAssertion: Joi.string(),
    clientAssertionType: Joi.string(),
    clientId: Joi.string().guid(),
    clientNotificationToken: Joi.string(),
    idTokenHint: Joi.string(),
    loginHint: Joi.string(),
    loginHintToken: Joi.string(),
    requestedExpiry: Joi.number(),
    scope: Joi.string().required(),
    userCode: Joi.string(),
  })
  .required();

export const oauthBackchannelController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseData> => {
  const {
    axios: { authenticationClient },
    data: {
      acrValues,
      bindingMessage,
      clientNotificationToken,
      loginHint,
      loginHintToken,
      requestedExpiry,
      scope,
      userCode,
    },
    entity: { client },
    redis: { backchannelSessionCache },
    token: { idToken },
  } = ctx;

  if (!client.active) {
    throw new ClientError("Invalid client", {
      code: "invalid_request",
      description: "Client is blocked",
      statusCode: ClientError.StatusCode.UNAUTHORIZED,
    });
  }

  const scopes = scope.toLowerCase().split(" ");

  const { factors, levelOfAssurance, methods, strategies } = extractAcrValues(acrValues);

  const defaultAudiences = uniqArray(
    client.id,
    client.audiences.identity,
    configuration.oauth.client_id,
    configuration.services.authentication_service.client_id,
    configuration.services.identity_service.client_id,
  );

  const audiences = idToken
    ? uniqArray(idToken.metadata.audiences, defaultAudiences)
    : defaultAudiences;

  const { expires, expiresIn } = expiryObject(configuration.defaults.expiry.backchannel_session);

  const backchannelSession = await backchannelSessionCache.create(
    new BackchannelSession({
      requestedConsent: { audiences, scopes },
      requestedLogin: {
        factors,
        identityId: idToken ? idToken.subject : null,
        levelOfAssurance,
        methods,
        minimumLevelOfAssurance: client.defaults.levelOfAssurance,
        strategies,
      },

      bindingMessage,
      clientId: client.id,
      clientNotificationToken,
      expires,
      idTokenHint: idToken ? idToken.token : null,
      loginHint,
      loginHintToken,
      requestedExpiry,
      userCode,
    }),
  );

  await authenticationClient.get<never, never, never, InitialiseBackchannelAuthQuery>(
    configuration.services.authentication_service.routes.admin.backchannel_auth,
    {
      query: { session: backchannelSession.id },
      middleware: [
        axiosBearerAuthMiddleware(
          generateServerCredentialsJwt(ctx, [
            configuration.services.authentication_service.client_id,
          ]),
        ),
      ],
    },
  );

  return {
    body: {
      authReqId: backchannelSession.id,
      expiresIn,
      interval: ms(configuration.defaults.interval.backchannel),
    },
  };
};
