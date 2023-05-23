import { AuthenticationMethod, AuthenticationMode, PKCEMethod } from "@lindorm-io/common-types";
import Joi from "joi";
import { JOI_PKCE_METHOD, REGEX_EMAIL, REGEX_PHONE } from "../../constant";
import { AuthenticationSession } from "../../entity";
import { configuration } from "../../server/configuration";
import { ServerKoaContext } from "../../types";
import { getOauthElevationRequest } from "../oauth-service";
import { handleAuthenticationInitialisation } from "./handle-authentication-initialisation";

type Options = {
  codeChallenge: string;
  codeChallengeMethod: PKCEMethod;
  elevationRequestId: string;
};

const schema = Joi.object<Options>()
  .keys({
    codeChallenge: Joi.string().required(),
    codeChallengeMethod: JOI_PKCE_METHOD.required(),
    elevationRequestId: Joi.string().guid().required(),
  })
  .required();

export const initialiseElevateAuthenticationSession = async (
  ctx: ServerKoaContext,
  options: Options,
): Promise<AuthenticationSession> => {
  await schema.validateAsync(options);

  const { codeChallenge, codeChallengeMethod, elevationRequestId } = options;

  const {
    elevation: {
      minimumLevel,
      recommendedLevel,
      recommendedMethods,
      requiredLevel,
      requiredMethods,
    },
    elevationRequest: { authenticationHint, country, expires, identityId, nonce },
  } = await getOauthElevationRequest(ctx, elevationRequestId);

  const emailHint = authenticationHint?.find((item: string) => REGEX_EMAIL.test(item));
  const phoneHint = authenticationHint?.find((item: string) => REGEX_PHONE.test(item));

  return await handleAuthenticationInitialisation(ctx, {
    id: elevationRequestId,
    clientId: configuration.oauth.client_id,
    codeChallenge,
    codeChallengeMethod,
    country,
    emailHint,
    expires: new Date(expires),
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
