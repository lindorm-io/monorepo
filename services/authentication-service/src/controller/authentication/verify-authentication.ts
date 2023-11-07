import {
  SessionStatus,
  VerifyAuthenticationRequestBody,
  VerifyAuthenticationRequestParams,
  VerifyAuthenticationResponse,
} from "@lindorm-io/common-types";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { expiryObject } from "@lindorm-io/expiry";
import { createOpaqueToken } from "@lindorm-io/jwt";
import { ControllerResponse } from "@lindorm-io/koa";
import { assertPKCE } from "@lindorm-io/node-pkce";
import Joi from "joi";
import { AuthenticationConfirmationToken } from "../../entity";
import { generateMfaCookie } from "../../handler";
import { argon } from "../../instance";
import { ServerKoaController } from "../../types";
import {
  calculateLevelOfAssurance,
  canGenerateMfaCookie,
  getFactorsFromStrategies,
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
    redis: {
      authenticationConfirmationTokenCache,
      authenticationSessionCache,
      strategySessionCache,
    },
    data: { code, codeVerifier },
    entity: { authenticationSession },
    logger,
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
  const authMethodsReference: Array<string> = getMethodsFromStrategies(authenticationSession);

  if (authenticationSession.confirmedFederationProvider) {
    authMethodsReference.push("federation");
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

  const opaqueToken = createOpaqueToken({ symbols: 0 });
  const { expires, expiresIn } = expiryObject("1 minutes");

  await authenticationConfirmationTokenCache.create(
    new AuthenticationConfirmationToken({
      id: opaqueToken.id,
      clientId: authenticationSession.clientId,
      confirmedIdentifiers: authenticationSession.confirmedIdentifiers,
      country: authenticationSession.country,
      expires,
      factors: getFactorsFromStrategies(authenticationSession),
      identityId: authenticationSession.identityId,
      levelOfAssurance: level,
      maximumLevelOfAssurance: maximum,
      metadata: authenticationSession.metadata,
      methods: getMethodsFromStrategies(authenticationSession),
      nonce: authenticationSession.nonce,
      remember: authenticationSession.remember,
      sessionId: authenticationSession.id,
      signature: opaqueToken.signature,
      singleSignOn: authenticationSession.sso,
      strategies: authenticationSession.confirmedStrategies,
    }),
  );

  if (canGenerateMfaCookie(authenticationSession)) {
    await generateMfaCookie(ctx, authenticationSession);
  }

  try {
    await authenticationSessionCache.destroy(authenticationSession);
    await strategySessionCache.deleteMany({ authenticationSessionId: authenticationSession.id });
  } catch (err: any) {
    logger.warn("Failed to destroy sessions", err);
  }

  return { body: { authenticationConfirmationToken: opaqueToken.token, expiresIn } };
};
