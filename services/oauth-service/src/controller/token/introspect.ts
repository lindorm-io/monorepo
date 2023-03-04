import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { TokenIntrospectRequestBody, TokenIntrospectResponseBody } from "@lindorm-io/common-types";
import { configuration } from "../../server/configuration";
import { getAdjustedAccessLevel } from "../../util";
import { getUnixTime } from "date-fns";
import { resolveTokenSession } from "../../handler";
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
    repository: { clientRepository, clientSessionRepository },
  } = ctx;

  try {
    const opaqueToken = await resolveTokenSession(ctx, token);
    const clientSession = await clientSessionRepository.find({ id: opaqueToken.clientSessionId });
    const client = await clientRepository.find({ id: clientSession.clientId });

    return {
      body: {
        active: true,
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
        exp: getUnixTime(opaqueToken.expires),
        iat: getUnixTime(opaqueToken.created),
        iss: configuration.server.issuer,
        jti: opaqueToken.id,
        loa: clientSession.levelOfAssurance,
        nbf: getUnixTime(opaqueToken.created),
        scope: clientSession.scopes.join(" "),
        sid: clientSession.id,
        sub: clientSession.identityId,
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
        loa: 0,
        nbf: 0,
        scope: null,
        sid: null,
        sub: null,
        tid: null,
        tokenType: null,
        username: null,
      },
    };
  }
};
