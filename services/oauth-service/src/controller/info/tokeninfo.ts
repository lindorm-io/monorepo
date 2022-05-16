import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { JOI_JWT } from "../../common";
import { TokenType } from "../../enum";
import { TokenError, TokenIssuer } from "@lindorm-io/jwt";

interface RequestData {
  token: string;
  tokenTypeHint: string;
}

interface ResponseBody {
  active: boolean;
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
}

export const tokeninfoSchema = Joi.object<RequestData>({
  token: JOI_JWT.required(),
  tokenTypeHint: Joi.string(),
});

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
  } = TokenIssuer.decode(token);

  let verifiedToken = false;
  let invalidToken = false;

  if (active) {
    try {
      jwt.verify(token, {
        types: tokenTypeHint ? [tokenTypeHint] : [TokenType.ACCESS, TokenType.REFRESH],
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
      ...(authContextClass?.length ? { acr: authContextClass } : {}),
      ...(authMethodsReference?.length ? { amr: authMethodsReference } : {}),
      aud: audiences,
      clientId: client.id,
      exp: expires,
      iat: issuedAt,
      iss: issuer,
      jti: id,
      ...(levelOfAssurance ? { loa: levelOfAssurance } : {}),
      nbf: notBefore,
      scope: scopes,
      sid: sessionId,
      sub: subject,
      tokenType: type,
      ...(username ? { username: username } : {}),
    },
  };
};
