import { SessionStatus } from "@lindorm-io/common-enums";
import {
  GetBackchannelSessionRequestParams,
  GetBackchannelSessionResponse,
} from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { ServerKoaController } from "../../types";

type RequestData = GetBackchannelSessionRequestParams;

type ResponseBody = GetBackchannelSessionResponse;

export const getBackchannelSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const getBackchannelController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    entity: { backchannelSession, client, tenant },
  } = ctx;

  return {
    body: {
      consent: {
        isRequired: backchannelSession.status.consent !== SessionStatus.CONFIRMED,
        status: backchannelSession.status.consent,

        audiences: backchannelSession.requestedConsent.audiences,
        optionalScopes: backchannelSession.requestedConsent.scopes.filter(
          (x) => !client.requiredScopes.includes(x),
        ),
        requiredScopes: client.requiredScopes,
        scopeDescriptions: client.scopeDescriptions,
      },

      login: {
        isRequired: backchannelSession.status.login !== SessionStatus.CONFIRMED,
        status: backchannelSession.status.login,

        factors: backchannelSession.requestedLogin.factors,
        identityId: backchannelSession.requestedLogin.identityId,
        levelOfAssurance: backchannelSession.requestedLogin.levelOfAssurance,
        methods: backchannelSession.requestedLogin.methods,
        minimumLevelOfAssurance: backchannelSession.requestedLogin.minimumLevelOfAssurance,
        strategies: backchannelSession.requestedLogin.strategies,
      },

      backchannelSession: {
        id: backchannelSession.id,
        bindingMessage: backchannelSession.bindingMessage,
        clientNotificationToken: backchannelSession.clientNotificationToken,
        expires: backchannelSession.expires.toISOString(),
        idTokenHint: backchannelSession.idTokenHint,
        loginHint: backchannelSession.loginHint,
        loginHintToken: backchannelSession.loginHintToken,
        requestedExpiry: backchannelSession.requestedExpiry,
        userCode: backchannelSession.userCode,
      },

      client: {
        id: client.id,
        name: client.name,
        logoUri: client.logoUri,
        singleSignOn: client.singleSignOn,
        type: client.type,
      },

      tenant: {
        id: tenant.id,
        name: tenant.name,
      },
    },
  };
};
