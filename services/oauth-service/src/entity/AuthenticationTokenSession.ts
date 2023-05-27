import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";
import Joi from "joi";
import { Scope } from "../types";

export type AuthenticationTokenSessionAttributes = EntityAttributes & {
  audiences: Array<string>;
  clientId: string;
  expires: Date;
  metadata: Record<string, any>;
  scopes: Array<Scope>;
  token: string;
};

export type AuthenticationTokenSessionOptions = Optional<
  AuthenticationTokenSessionAttributes,
  EntityKeys
>;

const schema = Joi.object<AuthenticationTokenSessionAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    audiences: Joi.array().items(Joi.string().guid()).required(),
    clientId: Joi.string().guid().required(),
    expires: Joi.date().required(),
    metadata: Joi.object().required(),
    scopes: Joi.array().items(Joi.string().lowercase()).required(),
    token: Joi.string().required(),
  })
  .required();

export class AuthenticationTokenSession extends LindormEntity<AuthenticationTokenSessionAttributes> {
  public readonly audiences: Array<string>;
  public readonly clientId: string;
  public readonly expires: Date;
  public readonly metadata: Record<string, any>;
  public readonly scopes: Array<Scope>;
  public readonly token: string;

  public constructor(options: AuthenticationTokenSessionOptions) {
    super(options);

    this.audiences = options.audiences;
    this.clientId = options.clientId;
    this.expires = options.expires;
    this.metadata = options.metadata;
    this.scopes = options.scopes;
    this.token = options.token;
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): AuthenticationTokenSessionAttributes {
    return {
      ...this.defaultJSON(),

      audiences: this.audiences,
      clientId: this.clientId,
      expires: this.expires,
      metadata: this.metadata,
      scopes: this.scopes,
      token: this.token,
    };
  }
}
