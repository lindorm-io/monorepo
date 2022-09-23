import Joi from "joi";
import { AuthenticationMode } from "../../enum";
import { AuthenticationSession } from "../../entity";
import { AuthenticationMethod, JOI_GUID } from "../../common";
import { JOI_PKCE_METHOD, REGEX_EMAIL, REGEX_PHONE } from "../../constant";
import { PKCEMethod } from "@lindorm-io/core";
import { ServerKoaContext } from "../../types";
import { configuration } from "../../server/configuration";
import { fetchOauthLoginData } from "../oauth-service";
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
    oauthSessionId: JOI_GUID.required(),
  })
  .required();

export const initialiseOauthAuthenticationSession = async (
  ctx: ServerKoaContext,
  options: Options,
): Promise<AuthenticationSession> => {
  await schema.validateAsync(options);

  const { codeChallenge, codeChallengeMethod, oauthSessionId } = options;

  const {
    authorizationSession: { country, expiresAt, loginHint, nonce },
    requested: {
      identityId,
      minimumLevel,
      recommendedLevel,
      recommendedMethods,
      requiredLevel,
      requiredMethods,
    },
  } = await fetchOauthLoginData(ctx, oauthSessionId);

  const emailHint = loginHint?.find((item) => REGEX_EMAIL.test(item));
  const phoneHint = loginHint?.find((item) => REGEX_PHONE.test(item));

  return await handleAuthenticationInitialisation(ctx, {
    id: oauthSessionId,
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
