import Joi from "joi";
import { AuthenticationSession } from "../../entity";
import { JOI_PKCE_METHOD, REGEX_EMAIL, REGEX_PHONE } from "../../constant";
import { ServerKoaContext } from "../../types";
import { configuration } from "../../server/configuration";
import { fetchOauthElevationData } from "../oauth-service";
import { handleAuthenticationInitialisation } from "./handle-authentication-initialisation";
import {
  AuthenticationMethod,
  AuthenticationMethods,
  AuthenticationModes,
  PKCEMethod,
} from "@lindorm-io/common-types";

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
    elevationSession: { authenticationHint, country, expiresAt, identityId, nonce },
    requested: {
      minimumLevel,
      recommendedLevel,
      recommendedMethods,
      requiredLevel,
      requiredMethods,
    },
  } = await fetchOauthElevationData(ctx, elevationSessionId);

  const emailHint = authenticationHint?.find((item: string) => REGEX_EMAIL.test(item));
  const phoneHint = authenticationHint?.find((item: string) => REGEX_PHONE.test(item));

  return await handleAuthenticationInitialisation(ctx, {
    id: elevationSessionId,
    clientId: configuration.oauth.client_id,
    codeChallenge,
    codeChallengeMethod,
    country,
    emailHint,
    expires: new Date(expiresAt),
    identityId,
    minimumLevel,
    mode: AuthenticationModes.OAUTH,
    nonce,
    phoneHint,
    recommendedLevel,
    recommendedMethods: recommendedMethods.filter((key: AuthenticationMethod) =>
      Object.values(AuthenticationMethods).includes(key),
    ) as Array<AuthenticationMethod>,
    requiredLevel,
    requiredMethods: requiredMethods.filter((key: AuthenticationMethod) =>
      Object.values(AuthenticationMethods).includes(key),
    ) as Array<AuthenticationMethod>,
  });
};
