import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { JOI_JWT } from "../../common";
import { ServerKoaController } from "../../types";
import { TokenError, JWT } from "@lindorm-io/jwt";
import { LindormTokenTypes } from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";

type RequestData = {
  token: string;
  tokenTypeHint: string;
};

type ResponseBody = {
  active: boolean;
  aal?: number;
  acr?: Array<string>;
  amr?: Array<string>;
  aud: Array<string>;
  authTime: number | null;
  azp: string | null;
  clientId: string;
  exp: number;
  iat: number;
  iss: string;
  jti: string;
  loa?: number;
  nbf: number;
  scope: Array<string>;
  sid: string | null;
  sub: string;
  tid: string | null;
  tokenType: string;
  username: string | null;
};

export const tokeninfoSchema = Joi.object<RequestData>()
  .keys({
    token: JOI_JWT.required(),
    tokenTypeHint: Joi.string(),
  })
  .required();

export const tokeninfoController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    cache: { invalidTokenCache },
    data: { token, tokenTypeHint },
    entity: { client },
    jwt,
  } = ctx;

  if (!client.active) {
    throw new ClientError("Invalid client", {
      code: "invalid_request",
      description: "Client is blocked",
      statusCode: ClientError.StatusCode.UNAUTHORIZED,
    });
  }

  const {
    id,
    active,
    adjustedAccessLevel,
    audiences,
    authContextClass,
    authMethodsReference,
    authTime,
    authorizedParty,
    expires,
    issuedAt,
    issuer,
    levelOfAssurance,
    notBefore,
    scopes,
    session,
    subject,
    tenant,
    type,
    username,
  } = JWT.decodeFormatted(token);

  let verifiedToken = false;
  let invalidToken = false;

  if (active) {
    try {
      jwt.verify(token, {
        types: tokenTypeHint
          ? [tokenTypeHint]
          : [LindormTokenTypes.ACCESS, LindormTokenTypes.REFRESH],
      });

      verifiedToken = true;
    } catch (err: any) {
      if (!(err instanceof TokenError)) {
        throw err;
      }
    }
  }

  if (active && verifiedToken) {
    try {
      await invalidTokenCache.find({ id });

      invalidToken = true;
    } catch (err: any) {
      if (!(err instanceof EntityNotFoundError)) {
        throw err;
      }
    }
  }

  return {
    body: {
      aal: adjustedAccessLevel,
      acr: authContextClass,
      active: active && verifiedToken && !invalidToken,
      amr: authMethodsReference,
      aud: audiences,
      authTime,
      azp: authorizedParty,
      clientId: client.id,
      exp: expires,
      iat: issuedAt,
      iss: issuer,
      jti: id,
      loa: levelOfAssurance,
      nbf: notBefore,
      scope: scopes,
      sid: session,
      sub: subject,
      tid: tenant,
      tokenType: type,
      username,
    },
  };
};
