import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { argon } from "../../instance";
import { assertPKCE, createURL } from "@lindorm-io/core";
import { canGenerateMfaCookie } from "../../util";
import { generateMfaCookie } from "../../handler";
import {
  AuthenticationConfirmationTokenClaims,
  JOI_GUID,
  SessionStatus,
  SubjectHint,
  TokenType,
  VerifyAuthenticationRequestData,
  VerifyAuthenticationResponseBody,
} from "../../common";

export const verifyAuthenticationSchema = Joi.object<VerifyAuthenticationRequestData>()
  .keys({
    id: JOI_GUID.required(),
    code: Joi.string().required(),
    codeVerifier: Joi.string().required(),
  })
  .required();

export const verifyAuthenticationController: ServerKoaController<
  VerifyAuthenticationRequestData
> = async (ctx): ControllerResponse<VerifyAuthenticationResponseBody> => {
  const {
    cache: { authenticationSessionCache },
    data: { code, codeVerifier },
    entity: { authenticationSession },
    jwt,
  } = ctx;

  if (authenticationSession.status !== SessionStatus.CODE) {
    throw new ClientError("Invalid session status");
  }

  assertPKCE(authenticationSession.codeChallenge, authenticationSession.codeMethod, codeVerifier);

  await argon.assert(code, authenticationSession.code);

  authenticationSession.status = SessionStatus.VERIFIED;

  const { expiresIn, token: authenticationConfirmationToken } = jwt.sign<
    never,
    AuthenticationConfirmationTokenClaims
  >({
    audiences: [authenticationSession.clientId],
    authContextClass: [`loa_${authenticationSession.confirmedLevelOfAssurance}`],
    authMethodsReference: authenticationSession.confirmedMethods,
    claims: {
      country: authenticationSession.country,
      remember: authenticationSession.remember,
    },
    expiry: "60 seconds",
    levelOfAssurance: authenticationSession.confirmedLevelOfAssurance,
    nonce: authenticationSession.nonce,
    scopes: ["authentication"],
    sessionId: authenticationSession.id,
    subject: authenticationSession.identityId,
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.AUTHENTICATION_CONFIRMATION,
  });

  if (canGenerateMfaCookie(authenticationSession)) {
    await generateMfaCookie(ctx, authenticationSession);
  }

  await authenticationSessionCache.update(authenticationSession);

  if (authenticationSession.redirectUri) {
    return {
      redirect: createURL(authenticationSession.redirectUri, {
        query: { authenticationConfirmationToken, expiresIn },
      }),
    };
  }

  return { body: { authenticationConfirmationToken, expiresIn } };
};
