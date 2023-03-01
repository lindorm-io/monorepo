import Joi from "joi";
import { JOI_LEVEL_OF_ASSURANCE, JOI_SESSION_STATUS } from "../common";
import {
  AuthenticationMethod,
  AuthenticationMode,
  AuthenticationStrategy,
  LevelOfAssurance,
  PKCEMethod,
  SessionStatus,
} from "@lindorm-io/common-types";
import {
  JOI_AUTHENTICATION_METHOD,
  JOI_AUTHENTICATION_STRATEGY,
  JOI_PKCE_METHOD,
} from "../constant";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export type AuthenticationSessionAttributes = EntityAttributes & {
  allowedStrategies: Array<AuthenticationStrategy>;
  clientId: string;
  code: string | null;
  codeChallenge: string;
  codeChallengeMethod: PKCEMethod;
  confirmedIdentifiers: Array<string>;
  confirmedOidcLevel: LevelOfAssurance;
  confirmedOidcProvider: string | null;
  confirmedStrategies: Array<AuthenticationStrategy>;
  country: string | null;
  emailHint: string | null;
  expires: Date;
  identityId: string | null;
  minimumLevel: LevelOfAssurance;
  mode: AuthenticationMode;
  nonce: string | null;
  phoneHint: string | null;
  recommendedLevel: LevelOfAssurance;
  recommendedMethods: Array<AuthenticationMethod>;
  remember: boolean;
  requiredLevel: LevelOfAssurance;
  requiredMethods: Array<AuthenticationMethod>;
  sso: boolean;
  status: SessionStatus;
};

export type AuthenticationSessionOptions = Optional<
  AuthenticationSessionAttributes,
  | EntityKeys
  | "allowedStrategies"
  | "code"
  | "confirmedIdentifiers"
  | "confirmedOidcLevel"
  | "confirmedOidcProvider"
  | "confirmedStrategies"
  | "country"
  | "emailHint"
  | "identityId"
  | "minimumLevel"
  | "nonce"
  | "phoneHint"
  | "recommendedLevel"
  | "recommendedMethods"
  | "remember"
  | "requiredLevel"
  | "requiredMethods"
  | "sso"
  | "status"
>;

const schema = Joi.object<AuthenticationSessionAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    allowedStrategies: Joi.array().items(JOI_AUTHENTICATION_STRATEGY).required(),
    clientId: Joi.string().guid().required(),
    code: Joi.string().allow(null).required(),
    codeChallenge: Joi.string().required(),
    codeChallengeMethod: JOI_PKCE_METHOD.required(),
    confirmedIdentifiers: Joi.array().items(Joi.string()).required(),
    confirmedOidcLevel: JOI_LEVEL_OF_ASSURANCE.required(),
    confirmedOidcProvider: Joi.string().allow(null).required(),
    confirmedStrategies: Joi.array().items(JOI_AUTHENTICATION_STRATEGY).required(),
    country: Joi.string().lowercase().length(2).allow(null).required(),
    emailHint: Joi.string().allow(null).required(),
    expires: Joi.date().required(),
    identityId: Joi.string().guid().allow(null).required(),
    minimumLevel: JOI_LEVEL_OF_ASSURANCE.required(),
    mode: Joi.string()
      .valid(AuthenticationMode.ELEVATE, AuthenticationMode.NONE, AuthenticationMode.OAUTH)
      .required(),
    nonce: Joi.string().allow(null).required(),
    phoneHint: Joi.string().allow(null).required(),
    recommendedLevel: JOI_LEVEL_OF_ASSURANCE.required(),
    recommendedMethods: Joi.array().items(JOI_AUTHENTICATION_METHOD).required(),
    remember: Joi.boolean().required(),
    requiredLevel: JOI_LEVEL_OF_ASSURANCE.required(),
    requiredMethods: Joi.array().items(JOI_AUTHENTICATION_METHOD).required(),
    sso: Joi.boolean().required(),
    status: JOI_SESSION_STATUS.required(),
  })
  .required();

export class AuthenticationSession
  extends LindormEntity<AuthenticationSessionAttributes>
  implements AuthenticationSessionAttributes
{
  public readonly clientId: string;
  public readonly codeChallenge: string;
  public readonly codeChallengeMethod: PKCEMethod;
  public readonly country: string | null;
  public readonly emailHint: string | null;
  public readonly expires: Date;
  public readonly minimumLevel: LevelOfAssurance;
  public readonly mode: AuthenticationMode;
  public readonly nonce: string | null;
  public readonly phoneHint: string | null;
  public readonly recommendedLevel: LevelOfAssurance;
  public readonly recommendedMethods: Array<AuthenticationMethod>;
  public readonly requiredLevel: LevelOfAssurance;
  public readonly requiredMethods: Array<AuthenticationMethod>;

  public allowedStrategies: Array<AuthenticationStrategy>;
  public code: string | null;
  public confirmedIdentifiers: Array<string>;
  public confirmedOidcLevel: LevelOfAssurance;
  public confirmedOidcProvider: string | null;
  public confirmedStrategies: Array<AuthenticationStrategy>;
  public identityId: string | null;
  public remember: boolean;
  public sso: boolean;
  public status: SessionStatus;

  public constructor(options: AuthenticationSessionOptions) {
    super(options);

    this.allowedStrategies = options.allowedStrategies || [];
    this.clientId = options.clientId;
    this.code = options.code || null;
    this.codeChallenge = options.codeChallenge;
    this.codeChallengeMethod = options.codeChallengeMethod;
    this.confirmedIdentifiers = options.confirmedIdentifiers || [];
    this.confirmedOidcLevel = options.confirmedOidcLevel || 0;
    this.confirmedOidcProvider = options.confirmedOidcProvider || null;
    this.confirmedStrategies = options.confirmedStrategies || [];
    this.country = options.country || null;
    this.emailHint = options.emailHint || null;
    this.expires = options.expires;
    this.identityId = options.identityId || null;
    this.minimumLevel = options.minimumLevel || 1;
    this.mode = options.mode;
    this.nonce = options.nonce || null;
    this.phoneHint = options.phoneHint || null;
    this.recommendedLevel = options.recommendedLevel || 1;
    this.recommendedMethods = options.recommendedMethods || [];
    this.remember = options.remember === true;
    this.requiredLevel = options.requiredLevel || 1;
    this.requiredMethods = options.requiredMethods || [];
    this.sso = options.sso === true;
    this.status = options.status || SessionStatus.PENDING;
  }

  public create(): void {
    /* intentionally left empty */
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): AuthenticationSessionAttributes {
    return {
      ...this.defaultJSON(),

      allowedStrategies: this.allowedStrategies,
      clientId: this.clientId,
      code: this.code,
      codeChallenge: this.codeChallenge,
      codeChallengeMethod: this.codeChallengeMethod,
      confirmedIdentifiers: this.confirmedIdentifiers,
      confirmedOidcLevel: this.confirmedOidcLevel,
      confirmedOidcProvider: this.confirmedOidcProvider,
      confirmedStrategies: this.confirmedStrategies,
      country: this.country,
      emailHint: this.emailHint,
      expires: this.expires,
      identityId: this.identityId,
      minimumLevel: this.minimumLevel,
      mode: this.mode,
      nonce: this.nonce,
      phoneHint: this.phoneHint,
      recommendedLevel: this.recommendedLevel,
      recommendedMethods: this.recommendedMethods,
      remember: this.remember,
      requiredLevel: this.requiredLevel,
      requiredMethods: this.requiredMethods,
      sso: this.sso,
      status: this.status,
    };
  }
}
