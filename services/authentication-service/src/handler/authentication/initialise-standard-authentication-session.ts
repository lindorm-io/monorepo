import {
  AuthenticationMethod,
  AuthenticationMode,
  AuthenticationStrategy,
  LevelOfAssurance,
  PKCEMethod,
} from "@lindorm-io/common-types";
import { expiryDate } from "@lindorm-io/expiry";
import Joi from "joi";
import { JOI_LEVEL_OF_ASSURANCE } from "../../common";
import {
  JOI_AUTHENTICATION_METHOD,
  JOI_AUTHENTICATION_STRATEGY,
  JOI_PKCE_METHOD,
  REGEX_EMAIL,
  REGEX_PHONE,
} from "../../constant";
import { AuthenticationSession } from "../../entity";
import { configuration } from "../../server/configuration";
import { ServerKoaContext } from "../../types";
import { filterAuthenticationMethods, filterAuthenticationStrategies } from "../../util";
import { handleAuthenticationInitialisation } from "./handle-authentication-initialisation";

type Options = {
  clientId: string;
  codeChallenge: string;
  codeChallengeMethod: PKCEMethod;
  country?: string;
  identityId?: string;
  levelOfAssurance?: LevelOfAssurance;
  loginHint?: Array<string>;
  methods?: Array<AuthenticationMethod>;
  nonce?: string;
  strategies?: Array<AuthenticationStrategy>;
};

const schema = Joi.object<Options>()
  .keys({
    clientId: Joi.string().guid().required(),
    codeChallenge: Joi.string().required(),
    codeChallengeMethod: JOI_PKCE_METHOD.required(),
    country: Joi.string().lowercase().length(2).optional(),
    identityId: Joi.string().guid().optional(),
    levelOfAssurance: JOI_LEVEL_OF_ASSURANCE.optional(),
    loginHint: Joi.array().items(Joi.string()).optional(),
    methods: Joi.array().items(JOI_AUTHENTICATION_METHOD).optional(),
    nonce: Joi.string().optional(),
    strategies: Joi.array().items(JOI_AUTHENTICATION_STRATEGY).optional(),
  })
  .options({ abortEarly: false, allowUnknown: false })
  .required();

export const initialiseStandardAuthenticationSession = async (
  ctx: ServerKoaContext,
  options: Options,
): Promise<AuthenticationSession> => {
  await schema.validateAsync(options);

  const {
    clientId,
    codeChallenge,
    codeChallengeMethod,
    country,
    identityId,
    levelOfAssurance,
    loginHint,
    methods,
    nonce,
    strategies,
  } = options;

  const expires = expiryDate(configuration.defaults.authentication_session_expiry);
  const emailHint = loginHint?.find((item) => REGEX_EMAIL.test(item));
  const phoneHint = loginHint?.find((item) => REGEX_PHONE.test(item));

  return await handleAuthenticationInitialisation(ctx, {
    clientId,
    codeChallenge,
    codeChallengeMethod,
    country,
    emailHint,
    expires,
    identityId,
    nonce,
    mode: AuthenticationMode.NONE,
    phoneHint,
    requiredLevelOfAssurance: levelOfAssurance,
    requiredMethods: filterAuthenticationMethods(methods),
    requiredStrategies: filterAuthenticationStrategies(strategies),
  });
};
