import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { argon } from "../../instance";
import { assertPKCE, createURL } from "@lindorm-io/core";
import { calculateLevelOfAssurance, canGenerateMfaCookie } from "../../util";
import { generateMfaCookie } from "../../handler";
import { getUnixTime } from "date-fns";
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

  assertPKCE(
    authenticationSession.codeChallenge,
    authenticationSession.codeChallengeMethod,
    codeVerifier,
  );

  await argon.assert(code, authenticationSession.code);

  const { maximumLevelOfAssurance } = calculateLevelOfAssurance(authenticationSession);

  const { expiresIn, token: authenticationConfirmationToken } = jwt.sign<
    never,
    AuthenticationConfirmationTokenClaims
  >({
    audiences: [authenticationSession.clientId],
    authContextClass: [`loa_${authenticationSession.confirmedLevelOfAssurance}`],
    authMethodsReference: authenticationSession.confirmedMethods,
    authTime: getUnixTime(new Date()),
    claims: {
      country: authenticationSession.country,
      remember: authenticationSession.remember,
      maximumLoa: maximumLevelOfAssurance,
      verifiedIdentifiers: authenticationSession.confirmedIdentifiers,
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

  await authenticationSessionCache.destroy(authenticationSession);

  if (authenticationSession.redirectUri) {
    return {
      redirect: createURL(authenticationSession.redirectUri, {
        query: { authenticationConfirmationToken, expiresIn },
      }),
    };
  }

  return { body: { authenticationConfirmationToken, expiresIn } };
};
