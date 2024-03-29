import { AuthenticationMode, PKCEMethod } from "@lindorm-io/common-enums";
import { JWT } from "@lindorm-io/jwt";
import Joi from "joi";
import { JOI_PKCE_METHOD, REGEX_EMAIL, REGEX_PHONE } from "../../constant";
import { AuthenticationSession } from "../../entity";
import { configuration } from "../../server/configuration";
import { ServerKoaContext } from "../../types";
import { filterAuthenticationMethods, filterAuthenticationStrategies } from "../../util";
import { getOauthAuthorizationSession } from "../oauth-service";
import { handleAuthenticationInitialisation } from "./handle-authentication-initialisation";

type Options = {
  codeChallenge: string;
  codeChallengeMethod: PKCEMethod;
  oauthSessionId: string;
};

const schema = Joi.object<Options>()
  .keys({
    codeChallenge: Joi.string().required(),
    codeChallengeMethod: JOI_PKCE_METHOD.required(),
    oauthSessionId: Joi.string().guid().required(),
  })
  .required();

export const initialiseOauthAuthenticationSession = async (
  ctx: ServerKoaContext,
  options: Options,
): Promise<AuthenticationSession> => {
  await schema.validateAsync(options);

  const { codeChallenge, codeChallengeMethod, oauthSessionId } = options;

  const {
    login: { factors, identityId, levelOfAssurance, methods, minimumLevelOfAssurance, strategies },
    authorizationSession: { country, expires, idTokenHint, loginHint, nonce },
  } = await getOauthAuthorizationSession(ctx, oauthSessionId);

  const emailHint = loginHint?.find((item: string) => REGEX_EMAIL.test(item));
  const phoneHint = loginHint?.find((item: string) => REGEX_PHONE.test(item));

  const idToken = idTokenHint ? JWT.decodePayload(idTokenHint) : undefined;

  return await handleAuthenticationInitialisation(ctx, {
    id: oauthSessionId,
    clientId: configuration.oauth.client_id,
    codeChallenge,
    codeChallengeMethod,
    country,
    emailHint,
    expires: new Date(expires),
    identityId,
    idTokenLevelOfAssurance: idToken?.metadata.levelOfAssurance,
    idTokenMethods: filterAuthenticationMethods(idToken?.metadata.authMethodsReference),
    minimumLevelOfAssurance,
    mode: AuthenticationMode.OAUTH,
    nonce,
    phoneHint,
    requiredFactors: factors,
    requiredLevelOfAssurance: levelOfAssurance,
    requiredMethods: filterAuthenticationMethods(methods),
    requiredStrategies: filterAuthenticationStrategies(strategies),
  });
};
