import Joi from "joi";
import { AuthenticationMethod, JOI_GUID } from "../../common";
import { AuthenticationMode } from "../../enum";
import { AuthenticationSession } from "../../entity";
import { JOI_PKCE_METHOD, REGEX_EMAIL, REGEX_PHONE } from "../../constant";
import { PKCEMethod } from "@lindorm-io/core";
import { ServerKoaContext } from "../../types";
import { configuration } from "../../server/configuration";
import { fetchOauthElevationData } from "../oauth-service/fetch-oauth-elevation-data";
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
    elevationSessionId: JOI_GUID.required(),
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

  const emailHint = authenticationHint?.find((item) => REGEX_EMAIL.test(item));
  const phoneHint = authenticationHint?.find((item) => REGEX_PHONE.test(item));

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
    mode: AuthenticationMode.OAUTH,
    nonce,
    phoneHint,
    recommendedLevel,
    recommendedMethods: recommendedMethods.filter((key: AuthenticationMethod) =>
      Object.values(AuthenticationMethod).includes(key),
    ) as Array<AuthenticationMethod>,
    requiredLevel,
    requiredMethods: requiredMethods.filter((key: AuthenticationMethod) =>
      Object.values(AuthenticationMethod).includes(key),
    ) as Array<AuthenticationMethod>,
  });
};
