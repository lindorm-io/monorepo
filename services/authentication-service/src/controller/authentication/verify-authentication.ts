import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { argon } from "../../instance";
import { assertPKCE } from "@lindorm-io/node-pkce";
import { generateMfaCookie } from "../../handler";
import { getUnixTime } from "date-fns";
import { AuthenticationConfirmationTokenClaims } from "../../common";
import {
  LindormTokenTypes,
  SessionStatuses,
  SubjectHints,
  VerifyAuthenticationRequestBody,
  VerifyAuthenticationResponse,
} from "@lindorm-io/common-types";
import {
  calculateLevelOfAssurance,
  canGenerateMfaCookie,
  getMethodsFromStrategies,
} from "../../util";

type RequestData = VerifyAuthenticationRequestBody;

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

  if (authenticationSession.status !== SessionStatuses.CODE) {
    throw new ClientError("Invalid session status");
  }

  assertPKCE(
    authenticationSession.codeChallenge,
    authenticationSession.codeChallengeMethod,
    codeVerifier,
  );

  await argon.assert(code, authenticationSession.code);

  const { level, maximum } = calculateLevelOfAssurance(authenticationSession);

  const authMethodsReference: Array<string> = getMethodsFromStrategies(
    authenticationSession.confirmedStrategies,
  );

  if (authenticationSession.confirmedOidcProvider) {
    authMethodsReference.push("oidc");
  }

  const { expiresIn, token: authenticationConfirmationToken } = jwt.sign<
    never,
    AuthenticationConfirmationTokenClaims
  >({
    audiences: [authenticationSession.clientId],
    authContextClass: [`loa_${level}`],
    authMethodsReference,
    authTime: getUnixTime(new Date()),
    claims: {
      country: authenticationSession.country,
      remember: authenticationSession.remember,
      maximumLoa: maximum,
      verifiedIdentifiers: authenticationSession.confirmedIdentifiers,
    },
    expiry: "60 seconds",
    levelOfAssurance: level,
    nonce: authenticationSession.nonce,
    scopes: ["authentication"],
    sessionId: authenticationSession.id,
    subject: authenticationSession.identityId,
    subjectHint: SubjectHints.IDENTITY,
    type: LindormTokenTypes.AUTHENTICATION_CONFIRMATION,
  });

  if (canGenerateMfaCookie(authenticationSession)) {
    await generateMfaCookie(ctx, authenticationSession);
  }

  await authenticationSessionCache.destroy(authenticationSession);

  return { body: { authenticationConfirmationToken, expiresIn } };
};
