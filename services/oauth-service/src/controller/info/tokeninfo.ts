import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { JOI_JWT } from "../../common";
import { ServerKoaController } from "../../types";
import { TokenError, JWT } from "@lindorm-io/jwt";
import { LindormTokenTypes } from "@lindorm-io/common-types";

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
  clientId: string;
  exp: number;
  iat: number;
  iss: string;
  jti: string;
  loa?: number;
  nbf: number;
  scope: Array<string>;
  sid: string;
  sub: string;
  tokenType: string;
  username?: string;
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

  const {
    id,
    adjustedAccessLevel,
    active,
    audiences,
    authContextClass,
    authMethodsReference,
    expires,
    issuedAt,
    issuer,
    levelOfAssurance,
    notBefore,
    scopes,
    sessionId,
    subject,
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
    } catch (err) {
      if (!(err instanceof TokenError)) {
        throw err;
      }
    }
  }

  if (active && verifiedToken) {
    try {
      await invalidTokenCache.find({ id });

      invalidToken = true;
    } catch (err) {
      if (!(err instanceof EntityNotFoundError)) {
        throw err;
      }
    }
  }

  return {
    body: {
      active: active && verifiedToken && !invalidToken,
      clientId: client.id,
      aal: adjustedAccessLevel,
      acr: authContextClass,
      amr: authMethodsReference,
      aud: audiences,
      exp: expires,
      iat: issuedAt,
      iss: issuer,
      jti: id,
      loa: levelOfAssurance,
      nbf: notBefore,
      scope: scopes,
      sid: sessionId,
      sub: subject,
      tokenType: type,
      username,
    },
  };
};
