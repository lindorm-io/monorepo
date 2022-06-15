import Joi from "joi";
import { AuthenticationMethod } from "../enum";
import { JOI_AUTHENTICATION_METHOD, JOI_PKCE_METHOD } from "../constant";
import { PKCEMethod } from "@lindorm-io/core";
import {
  JOI_GUID,
  JOI_LEVEL_OF_ASSURANCE,
  JOI_SESSION_STATUS,
  LevelOfAssurance,
  SessionStatus,
} from "../common";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export interface AuthenticationSessionAttributes extends EntityAttributes {
  allowedMethods: Array<AuthenticationMethod>;
  clientId: string;
  code: string | null;
  codeChallenge: string;
  codeMethod: PKCEMethod;
  confirmedIdentifiers: Array<string>;
  confirmedLevelOfAssurance: LevelOfAssurance;
  confirmedMethods: Array<AuthenticationMethod>;
  country: string | null;
  emailHint: string | null;
  expires: Date;
  identityId: string | null;
  loginSessionId: string | null;
  nonce: string | null;
  phoneHint: string | null;
  redirectUri: string | null;
  remember: boolean;
  requestedLevelOfAssurance: LevelOfAssurance;
  requestedMethods: Array<AuthenticationMethod>;
  status: SessionStatus;
}

export type AuthenticationSessionOptions = Optional<
  AuthenticationSessionAttributes,
  | EntityKeys
  | "allowedMethods"
  | "code"
  | "confirmedIdentifiers"
  | "confirmedLevelOfAssurance"
  | "confirmedMethods"
  | "country"
  | "emailHint"
  | "identityId"
  | "loginSessionId"
  | "nonce"
  | "phoneHint"
  | "redirectUri"
  | "remember"
  | "requestedLevelOfAssurance"
  | "requestedMethods"
  | "status"
>;

const schema = Joi.object<AuthenticationSessionAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    allowedMethods: Joi.array().items(JOI_AUTHENTICATION_METHOD).required(),
    clientId: JOI_GUID.required(),
    code: Joi.string().allow(null).required(),
    codeChallenge: Joi.string().required(),
    codeMethod: JOI_PKCE_METHOD.required(),
    confirmedIdentifiers: Joi.array().items(Joi.string()).required(),
    confirmedLevelOfAssurance: JOI_LEVEL_OF_ASSURANCE.required(),
    confirmedMethods: Joi.array().items(JOI_AUTHENTICATION_METHOD).required(),
    country: Joi.string().lowercase().length(2).allow(null).required(),
    emailHint: Joi.string().allow(null).required(),
    expires: Joi.date().required(),
    identityId: JOI_GUID.allow(null).required(),
    loginSessionId: JOI_GUID.allow(null).required(),
    nonce: Joi.string().allow(null).required(),
    redirectUri: Joi.string().uri().allow(null).required(),
    phoneHint: Joi.string().allow(null).required(),
    remember: Joi.boolean().required(),
    requestedLevelOfAssurance: JOI_LEVEL_OF_ASSURANCE.required(),
    requestedMethods: Joi.array().items(JOI_AUTHENTICATION_METHOD).required(),
    status: JOI_SESSION_STATUS.required(),
  })
  .required();

export class AuthenticationSession
  extends LindormEntity<AuthenticationSessionAttributes>
  implements AuthenticationSessionAttributes
{
  public readonly clientId: string;
  public readonly codeChallenge: string;
  public readonly codeMethod: PKCEMethod;
  public readonly country: string | null;
  public readonly emailHint: string | null;
  public readonly expires: Date;
  public readonly loginSessionId: string | null;
  public readonly nonce: string | null;
  public readonly phoneHint: string | null;
  public readonly redirectUri: string | null;
  public readonly requestedLevelOfAssurance: LevelOfAssurance;
  public readonly requestedMethods: Array<AuthenticationMethod>;

  public allowedMethods: Array<AuthenticationMethod>;
  public code: string | null;
  public confirmedIdentifiers: Array<string>;
  public confirmedLevelOfAssurance: LevelOfAssurance;
  public confirmedMethods: Array<AuthenticationMethod>;
  public identityId: string | null;
  public remember: boolean;
  public status: SessionStatus;

  public constructor(options: AuthenticationSessionOptions) {
    super(options);

    this.allowedMethods = options.allowedMethods || [];
    this.clientId = options.clientId;
    this.code = options.code || null;
    this.codeChallenge = options.codeChallenge;
    this.codeMethod = options.codeMethod;
    this.confirmedIdentifiers = options.confirmedIdentifiers || [];
    this.confirmedLevelOfAssurance = options.confirmedLevelOfAssurance || 0;
    this.confirmedMethods = options.confirmedMethods || [];
    this.country = options.country || null;
    this.emailHint = options.emailHint || null;
    this.expires = options.expires;
    this.identityId = options.identityId || null;
    this.loginSessionId = options.loginSessionId || null;
    this.nonce = options.nonce || null;
    this.phoneHint = options.phoneHint || null;
    this.redirectUri = options.redirectUri || null;
    this.remember = options.remember === true;
    this.requestedLevelOfAssurance = options.requestedLevelOfAssurance || 1;
    this.requestedMethods = options.requestedMethods || [];
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

      allowedMethods: this.allowedMethods,
      clientId: this.clientId,
      code: this.code,
      codeChallenge: this.codeChallenge,
      codeMethod: this.codeMethod,
      confirmedIdentifiers: this.confirmedIdentifiers,
      confirmedLevelOfAssurance: this.confirmedLevelOfAssurance,
      confirmedMethods: this.confirmedMethods,
      country: this.country,
      emailHint: this.emailHint,
      expires: this.expires,
      identityId: this.identityId,
      loginSessionId: this.loginSessionId,
      nonce: this.nonce,
      phoneHint: this.phoneHint,
      redirectUri: this.redirectUri,
      remember: this.remember,
      requestedLevelOfAssurance: this.requestedLevelOfAssurance,
      requestedMethods: this.requestedMethods,
      status: this.status,
    };
  }
}
