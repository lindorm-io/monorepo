import Joi from "joi";
import { FlowType } from "../enum";
import { JOI_FLOW_TYPE } from "../constant";
import { JOI_GUID, JOI_LEVEL_OF_ASSURANCE, LevelOfAssurance } from "../common";
import { configuration } from "../configuration";
import { getExpiryDate, PKCEMethod } from "@lindorm-io/core";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export interface LoginSessionAttributes extends EntityAttributes {
  allowedFlows: Array<FlowType>;
  allowedOidc: Array<string>;
  amrValues: Array<string>;
  country: string | null;
  deviceLinks: Array<string>;
  expires: Date;
  identityId: string | null;
  levelOfAssurance: LevelOfAssurance;
  loginHint: Array<string>;
  oauthSessionId: string | null;
  pkceChallenge: string | null;
  pkceMethod: PKCEMethod | null;
  remember: boolean;
  requestedAuthenticationMethods: Array<string>;
  requestedLevelOfAssurance: LevelOfAssurance;
  sessions: Array<string>;
}

export type LoginSessionOptions = Optional<
  LoginSessionAttributes,
  | EntityKeys
  | "allowedFlows"
  | "allowedOidc"
  | "amrValues"
  | "country"
  | "deviceLinks"
  | "expires"
  | "identityId"
  | "levelOfAssurance"
  | "loginHint"
  | "oauthSessionId"
  | "pkceChallenge"
  | "pkceMethod"
  | "remember"
  | "requestedAuthenticationMethods"
  | "requestedLevelOfAssurance"
  | "sessions"
>;

const schema = Joi.object<LoginSessionAttributes>({
  ...JOI_ENTITY_BASE,

  allowedFlows: Joi.array().items(JOI_FLOW_TYPE).required(),
  allowedOidc: Joi.array().items(Joi.string()).required(),
  amrValues: Joi.array().items(JOI_FLOW_TYPE).required(),
  country: Joi.string().length(2).allow(null).required(),
  deviceLinks: Joi.array().items(JOI_GUID).required(),
  expires: Joi.date().required(),
  identityId: JOI_GUID.allow(null).required(),
  levelOfAssurance: JOI_LEVEL_OF_ASSURANCE.required(),
  loginHint: Joi.array().items(Joi.string()).required(),
  oauthSessionId: JOI_GUID.allow(null).required(),
  pkceChallenge: Joi.string().allow(null).required(),
  pkceMethod: Joi.string().allow(null).required(),
  remember: Joi.boolean().required(),
  requestedAuthenticationMethods: Joi.array().items(Joi.string()).required(),
  requestedLevelOfAssurance: JOI_LEVEL_OF_ASSURANCE.required(),
  sessions: Joi.array().items(JOI_GUID).required(),
});

export class LoginSession
  extends LindormEntity<LoginSessionAttributes>
  implements LoginSessionAttributes
{
  public readonly pkceChallenge: string | null;
  public readonly pkceMethod: PKCEMethod | null;

  public allowedFlows: Array<FlowType>;
  public allowedOidc: Array<string>;
  public amrValues: Array<string>;
  public country: string | null;
  public deviceLinks: Array<string>;
  public expires: Date;
  public identityId: string | null;
  public levelOfAssurance: LevelOfAssurance;
  public loginHint: Array<string>;
  public oauthSessionId: string | null;
  public remember: boolean;
  public requestedAuthenticationMethods: Array<string>;
  public requestedLevelOfAssurance: LevelOfAssurance;
  public sessions: Array<string>;

  public constructor(options: LoginSessionOptions) {
    super(options);

    this.allowedFlows = options.allowedFlows || [];
    this.allowedOidc = options.allowedOidc || [];
    this.amrValues = options.amrValues || [];
    this.country = options.country || null;
    this.deviceLinks = options.deviceLinks || [];
    this.expires = options.expires || getExpiryDate(configuration.expiry.login_session);
    this.identityId = options.identityId || null;
    this.levelOfAssurance = options.levelOfAssurance || 0;
    this.loginHint = options.loginHint || [];
    this.oauthSessionId = options.oauthSessionId || null;
    this.pkceChallenge = options.pkceChallenge || null;
    this.pkceMethod = options.pkceMethod || null;
    this.remember = options.remember === true;
    this.requestedAuthenticationMethods = options.requestedAuthenticationMethods || [];
    this.requestedLevelOfAssurance = options.requestedLevelOfAssurance || 2;
    this.sessions = options.sessions || [];
  }

  public create(): void {
    /* intentionally left empty */
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): LoginSessionAttributes {
    return {
      ...this.defaultJSON(),

      allowedFlows: this.allowedFlows,
      allowedOidc: this.allowedOidc,
      amrValues: this.amrValues,
      country: this.country,
      deviceLinks: this.deviceLinks,
      expires: this.expires,
      identityId: this.identityId,
      levelOfAssurance: this.levelOfAssurance,
      loginHint: this.loginHint,
      oauthSessionId: this.oauthSessionId,
      pkceChallenge: this.pkceChallenge,
      pkceMethod: this.pkceMethod,
      remember: this.remember,
      requestedAuthenticationMethods: this.requestedAuthenticationMethods,
      requestedLevelOfAssurance: this.requestedLevelOfAssurance,
      sessions: this.sessions,
    };
  }
}
