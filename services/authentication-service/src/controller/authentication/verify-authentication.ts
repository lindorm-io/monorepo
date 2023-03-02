import Joi from "joi";
import { AuthenticationConfirmationTokenClaims } from "../../common";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { argon } from "../../instance";
import { assertPKCE } from "@lindorm-io/node-pkce";
import { generateMfaCookie } from "../../handler";
import { getUnixTime } from "date-fns";
import {
  AuthenticationTokenType,
  SessionStatus,
  SubjectHint,
  VerifyAuthenticationRequestBody,
  VerifyAuthenticationRequestParams,
  VerifyAuthenticationResponse,
} from "@lindorm-io/common-types";
import {
  calculateLevelOfAssurance,
  canGenerateMfaCookie,
  getMethodsFromStrategies,
} from "../../util";

type RequestData = VerifyAuthenticationRequestParams & VerifyAuthenticationRequestBody;

type ResponseBody = VerifyAuthenticationResponse;

export const verifyAuthenticationSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    code: Joi.string().required(),
    codeVerifier: Joi.string().required(),
  })
  .required();

export const verifyAuthenticationController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
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

  if (!authenticationSession.code) {
    throw new ServerError("Invalid authenticationSession", {
      debug: { code: authenticationSession.code },
    });
  }

  await argon.assert(code, authenticationSession.code);

  const { level, maximum } = calculateLevelOfAssurance(authenticationSession);

  const authMethodsReference: Array<string> = getMethodsFromStrategies(
    authenticationSession.confirmedStrategies,
  );

  if (authenticationSession.confirmedOidcProvider) {
    authMethodsReference.push("oidc");
  }

  if (!authenticationSession.nonce) {
    throw new ServerError("Invalid authenticationSession", {
      debug: { nonce: authenticationSession.nonce },
    });
  }

  if (!authenticationSession.identityId) {
    throw new ServerError("Invalid authenticationSession", {
      debug: { identityId: authenticationSession.identityId },
    });
  }

  const { token: authenticationConfirmationToken, expiresIn } = jwt.sign<
    never,
    AuthenticationConfirmationTokenClaims
  >({
    audiences: [authenticationSession.clientId],
    authContextClass: [`loa_${level}`],
    authMethodsReference,
    authTime: getUnixTime(new Date()),
    claims: {
      country: authenticationSession.country,
      maximumLoa: maximum,
      remember: authenticationSession.remember,
      sso: authenticationSession.sso,
      verifiedIdentifiers: authenticationSession.confirmedIdentifiers,
    },
    expiry: "60 seconds",
    levelOfAssurance: level,
    nonce: authenticationSession.nonce,
    scopes: ["authentication"],
    session: authenticationSession.id,
    subject: authenticationSession.identityId,
    subjectHint: SubjectHint.IDENTITY,
    type: AuthenticationTokenType.AUTHENTICATION_CONFIRMATION,
  });

  if (canGenerateMfaCookie(authenticationSession)) {
    await generateMfaCookie(ctx, authenticationSession);
  }

  await authenticationSessionCache.destroy(authenticationSession);

  return { body: { authenticationConfirmationToken, expiresIn } };
};
