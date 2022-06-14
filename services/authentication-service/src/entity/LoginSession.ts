import Joi from "joi";
import { JOI_GUID, JOI_SESSION_STATUS, SessionStatus } from "../common";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export interface LoginSessionAttributes extends EntityAttributes {
  authenticationSessionId: string;
  codeVerifier: string;
  expires: Date;
  remember: boolean;
  oauthSessionId: string;
  status: SessionStatus;
}

export type LoginSessionOptions = Optional<
  LoginSessionAttributes,
  EntityKeys | "remember" | "status"
>;

const schema = Joi.object<LoginSessionAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    authenticationSessionId: JOI_GUID.required(),
    codeVerifier: Joi.string().required(),
    expires: Joi.date().required(),
    oauthSessionId: JOI_GUID.required(),
    remember: Joi.boolean().required(),
    status: JOI_SESSION_STATUS.required(),
  })
  .required();

export class LoginSession
  extends LindormEntity<LoginSessionAttributes>
  implements LoginSessionAttributes
{
  public readonly authenticationSessionId: string;
  public readonly codeVerifier: string;
  public readonly expires: Date;
  public readonly oauthSessionId: string;

  public remember: boolean;
  public status: SessionStatus;

  public constructor(options: LoginSessionOptions) {
    super(options);

    this.authenticationSessionId = options.authenticationSessionId;
    this.codeVerifier = options.codeVerifier;
    this.expires = options.expires;
    this.oauthSessionId = options.oauthSessionId;
    this.remember = options.remember === true;
    this.status = options.status || SessionStatus.PENDING;
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

      authenticationSessionId: this.authenticationSessionId,
      codeVerifier: this.codeVerifier,
      expires: this.expires,
      oauthSessionId: this.oauthSessionId,
      remember: this.remember,
      status: this.status,
    };
  }
}
