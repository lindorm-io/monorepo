import { AuthenticationStrategy, IdentifierType, SessionStatus } from "@lindorm-io/common-types";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";
import { randomString } from "@lindorm-io/random";
import Joi from "joi";
import { JOI_SESSION_STATUS } from "../common";
import { JOI_AUTHENTICATION_STRATEGY } from "../constant";

export type StrategySessionAttributes = EntityAttributes & {
  authenticationSessionId: string;
  expires: Date;
  identifier: string;
  identifierType: IdentifierType;
  identityId: string | null;
  nonce: string | null;
  secret: string | null;
  status: SessionStatus;
  strategy: AuthenticationStrategy;
  visualHint: string | null;
};

export type StrategySessionOptions = Optional<
  StrategySessionAttributes,
  EntityKeys | "identityId" | "nonce" | "secret" | "status" | "visualHint"
>;

const schema = Joi.object<StrategySessionAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    authenticationSessionId: Joi.string().guid().required(),
    expires: Joi.date().required(),
    identityId: Joi.string().guid().allow(null).required(),
    identifier: Joi.string().required(),
    identifierType: Joi.string()
      .valid(...Object.values(IdentifierType))
      .required(),
    nonce: Joi.string().required(),
    secret: Joi.string().allow(null).required(),
    status: JOI_SESSION_STATUS.required(),
    strategy: JOI_AUTHENTICATION_STRATEGY.required(),
    visualHint: Joi.string().required(),
  })
  .required();

export class StrategySession
  extends LindormEntity<StrategySessionAttributes>
  implements StrategySessionAttributes
{
  public readonly authenticationSessionId: string;
  public readonly expires: Date;
  public readonly identifier: string;
  public readonly identifierType: IdentifierType;
  public readonly nonce: string;
  public readonly strategy: AuthenticationStrategy;
  public readonly visualHint: string;

  public identityId: string | null;
  public secret: string | null;
  public status: SessionStatus;

  public constructor(options: StrategySessionOptions) {
    super(options);

    this.authenticationSessionId = options.authenticationSessionId;
    this.expires = options.expires;
    this.identityId = options.identityId || null;
    this.identifier = options.identifier;
    this.identifierType = options.identifierType;
    this.nonce = options.nonce || randomString(16);
    this.secret = options.secret || null;
    this.status = options.status || SessionStatus.PENDING;
    this.strategy = options.strategy;
    this.visualHint = options.visualHint || randomString(4).toUpperCase();
  }

  public create(): void {
    /* intentionally left empty */
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): StrategySessionAttributes {
    return {
      ...this.defaultJSON(),

      authenticationSessionId: this.authenticationSessionId,
      expires: this.expires,
      identityId: this.identityId,
      identifier: this.identifier,
      identifierType: this.identifierType,
      nonce: this.nonce,
      secret: this.secret,
      status: this.status,
      strategy: this.strategy,
      visualHint: this.visualHint,
    };
  }
}
