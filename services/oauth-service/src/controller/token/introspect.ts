import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { TokenIntrospectRequestBody, TokenIntrospectResponseBody } from "@lindorm-io/common-types";
import { configuration } from "../../server/configuration";
import { convertOpaqueTokenToJwt, resolveTokenSession } from "../../handler";
import { getAdjustedAccessLevel } from "../../util";
import { getUnixTime } from "date-fns";
import { uniqArray } from "@lindorm-io/core";

type RequestData = TokenIntrospectRequestBody;

type ResponseBody = TokenIntrospectResponseBody;

export const tokenIntrospectSchema = Joi.object<RequestData>()
  .keys({
    token: Joi.string().required(),
    tokenTypeHint: Joi.string(),
  })
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

    const { token: jwt } = convertOpaqueTokenToJwt(ctx, clientSession, opaqueToken);

    const exp = getUnixTime(opaqueToken.expires);
    const iat = getUnixTime(opaqueToken.created);
    const now = getUnixTime(new Date());

    return {
      body: {
        active: exp - now > 0 && now - iat >= 0,
        aal: getAdjustedAccessLevel(clientSession),
        acr: `loa_${clientSession.levelOfAssurance}`,
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
        iat,
        iss: configuration.server.issuer,
        jti: opaqueToken.id,
        jwt,
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
        amr: [],
        aud: [],
        authTime: 0,
        azp: null,
        clientId: null,
        exp: 0,
        iat: 0,
        iss: null,
        jti: null,
        jwt: null,
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
