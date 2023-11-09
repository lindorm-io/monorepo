import { AuthenticationMode, PKCEMethod } from "@lindorm-io/common-enums";
import { JWT } from "@lindorm-io/jwt";
import Joi from "joi";
import { JOI_PKCE_METHOD, REGEX_EMAIL, REGEX_PHONE } from "../../constant";
import { AuthenticationSession } from "../../entity";
import { configuration } from "../../server/configuration";
import { ServerKoaContext } from "../../types";
import { filterAuthenticationMethods, filterAuthenticationStrategies } from "../../util";
import { getOauthElevationSession } from "../oauth-service";
import { handleAuthenticationInitialisation } from "./handle-authentication-initialisation";

type Options = {
  codeChallenge: string;
  codeChallengeMethod: PKCEMethod;
  elevationSessionId: string;
};

const schema = Joi.object<Options>()
  .keys({
    codeChallenge: Joi.string().required(),
    codeChallengeMethod: JOI_PKCE_METHOD.required(),
    elevationSessionId: Joi.string().guid().required(),
  })
  .required();

export const initialiseElevateAuthenticationSession = async (
  ctx: ServerKoaContext,
  options: Options,
): Promise<AuthenticationSession> => {
  await schema.validateAsync(options);

  const { codeChallenge, codeChallengeMethod, elevationSessionId } = options;

  const {
    elevation: { factors, levelOfAssurance, methods, minimumLevelOfAssurance, strategies },
    elevationSession: { authenticationHint, country, expires, identityId, idTokenHint, nonce },
  } = await getOauthElevationSession(ctx, elevationSessionId);

  const emailHint = authenticationHint?.find((item: string) => REGEX_EMAIL.test(item));
  const phoneHint = authenticationHint?.find((item: string) => REGEX_PHONE.test(item));

  const idToken = idTokenHint ? JWT.decodePayload(idTokenHint) : undefined;

  return await handleAuthenticationInitialisation(ctx, {
    id: elevationSessionId,
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
