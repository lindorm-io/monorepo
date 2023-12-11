import { TokenIntrospectRequestBody, TokenIntrospectResponseBody } from "@lindorm-io/common-types";
import { uniqArray } from "@lindorm-io/core";
import { ControllerResponse } from "@lindorm-io/koa";
import { getUnixTime } from "date-fns";
import Joi from "joi";
import { resolveTokenSession } from "../../handler";
import { configuration } from "../../server/configuration";
import { ServerKoaController } from "../../types";
import {
  getAdjustedAccessLevel,
  getAuthenticationLevelFromLevelOfAssurance,
  getPrimaryFactor,
} from "../../util";

type RequestData = TokenIntrospectRequestBody;

type ResponseBody = TokenIntrospectResponseBody;

export const tokenIntrospectSchema = Joi.object<RequestData>()
  .keys({
    token: Joi.string().min(128).required(),
  })
  .options({ abortEarly: false, allowUnknown: true })
  .required();

export const tokenIntrospectController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    data: { token },
    mongo: { clientRepository, clientSessionRepository },
  } = ctx;

  try {
    const opaqueToken = await resolveTokenSession(ctx, token);
    const clientSession = await clientSessionRepository.find({ id: opaqueToken.clientSessionId });
    const client = await clientRepository.find({ id: clientSession.clientId });

    const exp = getUnixTime(opaqueToken.expires);
    const iat = getUnixTime(opaqueToken.created);
    const now = getUnixTime(new Date());

    return {
      body: {
        active: exp - now > 0 && now - iat >= 0,
        aal: getAdjustedAccessLevel(clientSession),
        acr: getAuthenticationLevelFromLevelOfAssurance(clientSession.levelOfAssurance),
        afr: getPrimaryFactor(clientSession.factors),
        amr: clientSession.methods,
        aud: uniqArray(
          client.id,
          clientSession.audiences,
          configuration.oauth.client_id,
          configuration.services.authentication_service.client_id,
          configuration.services.identity_service.client_id,
        ),
        authTime: getUnixTime(clientSession.latestAuthentication),
        azp: client.id,
        clientId: client.id,
        exp,
        gty: null,
        iat,
        iss: configuration.server.issuer,
        jti: opaqueToken.id,
        loa: clientSession.levelOfAssurance,
        nbf: iat,
        scope: clientSession.scopes.join(" "),
        sid: clientSession.id,
        sih: "client_session",
        sub: clientSession.identityId,
        suh: "identity",
        tid: client.tenantId,
        tokenType: opaqueToken.type,
        username: clientSession.identityId,
      },
    };
  } catch (_) {
    return {
      body: {
        active: false,
        aal: 0,
        acr: null,
        afr: null,
        amr: [],
        aud: [],
        authTime: 0,
        azp: null,
        clientId: null,
        exp: 0,
        gty: null,
        iat: 0,
        iss: null,
        jti: null,
        loa: 0,
        nbf: 0,
        scope: null,
        sid: null,
        sih: null,
        sub: null,
        suh: null,
        tid: null,
        tokenType: null,
        username: null,
      },
    };
  }
};
