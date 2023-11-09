import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationMode,
  AuthenticationStrategy,
  PKCEMethod,
  SessionStatus,
} from "@lindorm-io/common-enums";
import { Dict, LevelOfAssurance } from "@lindorm-io/common-types";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";
import Joi from "joi";
import { JOI_LEVEL_OF_ASSURANCE, JOI_SESSION_STATUS } from "../common";
import { JOI_PKCE_METHOD } from "../constant";

export type AuthenticationSessionAttributes = EntityAttributes & {
  allowedStrategies: Array<AuthenticationStrategy>;
  clientId: string;
  code: string | null;
  codeChallenge: string;
  codeChallengeMethod: PKCEMethod;
  confirmedFederationLevel: LevelOfAssurance;
  confirmedFederationProvider: string | null;
  confirmedIdentifiers: Array<string>;
  confirmedStrategies: Array<AuthenticationStrategy>;
  country: string | null;
  emailHint: string | null;
  expires: Date;
  identityId: string | null;
  idTokenLevelOfAssurance: LevelOfAssurance;
  idTokenMethods: Array<AuthenticationMethod>;
  metadata: Dict;
  minimumLevelOfAssurance: LevelOfAssurance;
  mode: AuthenticationMode;
  nonce: string | null;
  phoneHint: string | null;
  remember: boolean;
  requiredFactors: Array<AuthenticationFactor>;
  requiredLevelOfAssurance: LevelOfAssurance;
  requiredMethods: Array<AuthenticationMethod>;
  requiredStrategies: Array<AuthenticationStrategy>;
  sso: boolean;
  status: SessionStatus;
};

export type AuthenticationSessionOptions = Optional<
  AuthenticationSessionAttributes,
  | EntityKeys
  | "allowedStrategies"
  | "code"
  | "confirmedFederationLevel"
  | "confirmedFederationProvider"
  | "confirmedIdentifiers"
  | "confirmedStrategies"
  | "country"
  | "emailHint"
  | "identityId"
  | "idTokenLevelOfAssurance"
  | "idTokenMethods"
  | "metadata"
  | "minimumLevelOfAssurance"
  | "nonce"
  | "phoneHint"
  | "remember"
  | "requiredFactors"
  | "requiredLevelOfAssurance"
  | "requiredMethods"
  | "requiredStrategies"
  | "sso"
  | "status"
>;

const schema = Joi.object<AuthenticationSessionAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    allowedStrategies: Joi.array().items(Joi.string().lowercase()).required(),
    clientId: Joi.string().guid().required(),
    code: Joi.string().allow(null).required(),
    codeChallenge: Joi.string().required(),
    codeChallengeMethod: JOI_PKCE_METHOD.required(),
    confirmedFederationLevel: JOI_LEVEL_OF_ASSURANCE.required(),
    confirmedFederationProvider: Joi.string().allow(null).required(),
    confirmedIdentifiers: Joi.array().items(Joi.string()).required(),
    confirmedStrategies: Joi.array().items(Joi.string().lowercase()).required(),
    country: Joi.string().lowercase().length(2).allow(null).required(),
    emailHint: Joi.string().allow(null).required(),
    expires: Joi.date().required(),
    identityId: Joi.string().guid().allow(null).required(),
    idTokenLevelOfAssurance: JOI_LEVEL_OF_ASSURANCE.required(),
    idTokenMethods: Joi.array().items(Joi.string().lowercase()).required(),
    metadata: Joi.object().required(),
    minimumLevelOfAssurance: JOI_LEVEL_OF_ASSURANCE.required(),
    mode: Joi.string()
      .valid(AuthenticationMode.ELEVATE, AuthenticationMode.NONE, AuthenticationMode.OAUTH)
      .required(),
    nonce: Joi.string().allow(null).required(),
    phoneHint: Joi.string().allow(null).required(),
    remember: Joi.boolean().required(),
    requiredFactors: Joi.array().items(Joi.string().lowercase()).required(),
    requiredLevelOfAssurance: JOI_LEVEL_OF_ASSURANCE.required(),
    requiredMethods: Joi.array().items(Joi.string().lowercase()).required(),
    requiredStrategies: Joi.array().items(Joi.string().lowercase()).required(),
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
  public readonly idTokenLevelOfAssurance: LevelOfAssurance;
  public readonly idTokenMethods: Array<AuthenticationMethod>;
  public readonly minimumLevelOfAssurance: LevelOfAssurance;
  public readonly mode: AuthenticationMode;
  public readonly nonce: string | null;
  public readonly phoneHint: string | null;
  public readonly requiredFactors: Array<AuthenticationFactor>;
  public readonly requiredLevelOfAssurance: LevelOfAssurance;
  public readonly requiredMethods: Array<AuthenticationMethod>;
  public readonly requiredStrategies: Array<AuthenticationStrategy>;

  public allowedStrategies: Array<AuthenticationStrategy>;
  public code: string | null;
  public confirmedIdentifiers: Array<string>;
  public confirmedFederationLevel: LevelOfAssurance;
  public confirmedFederationProvider: string | null;
  public confirmedStrategies: Array<AuthenticationStrategy>;
  public identityId: string | null;
  public metadata: Dict;
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
    this.confirmedFederationLevel = options.confirmedFederationLevel || 0;
    this.confirmedFederationProvider = options.confirmedFederationProvider || null;
    this.confirmedIdentifiers = options.confirmedIdentifiers || [];
    this.confirmedStrategies = options.confirmedStrategies || [];
    this.country = options.country || null;
    this.emailHint = options.emailHint || null;
    this.expires = options.expires;
    this.identityId = options.identityId || null;
    this.idTokenLevelOfAssurance = options.idTokenLevelOfAssurance || 1;
    this.idTokenMethods = options.idTokenMethods || [];
    this.metadata = options.metadata || {};
    this.minimumLevelOfAssurance = options.minimumLevelOfAssurance || 1;
    this.mode = options.mode;
    this.nonce = options.nonce || null;
    this.phoneHint = options.phoneHint || null;
    this.remember = options.remember === true;
    this.requiredFactors = options.requiredFactors || [];
    this.requiredLevelOfAssurance = options.requiredLevelOfAssurance || 1;
    this.requiredMethods = options.requiredMethods || [];
    this.requiredStrategies = options.requiredStrategies || [];
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
      confirmedFederationLevel: this.confirmedFederationLevel,
      confirmedFederationProvider: this.confirmedFederationProvider,
      confirmedIdentifiers: this.confirmedIdentifiers,
      confirmedStrategies: this.confirmedStrategies,
      country: this.country,
      emailHint: this.emailHint,
      expires: this.expires,
      identityId: this.identityId,
      idTokenLevelOfAssurance: this.idTokenLevelOfAssurance,
      idTokenMethods: this.idTokenMethods,
      metadata: this.metadata,
      minimumLevelOfAssurance: this.minimumLevelOfAssurance,
      mode: this.mode,
      nonce: this.nonce,
      phoneHint: this.phoneHint,
      remember: this.remember,
      requiredFactors: this.requiredFactors,
      requiredLevelOfAssurance: this.requiredLevelOfAssurance,
      requiredMethods: this.requiredMethods,
      requiredStrategies: this.requiredStrategies,
      sso: this.sso,
      status: this.status,
    };
  }
}
