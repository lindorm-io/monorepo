import Joi from "joi";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export type ConsentSessionAttributes = EntityAttributes & {
  audiences: Array<string>;
  clientId: string;
  identityId: string;
  scopes: Array<string>;
  sessions: Array<string>;
};

export type ConsentSessionOptions = Optional<
  ConsentSessionAttributes,
  EntityKeys | "audiences" | "scopes" | "sessions"
>;

const schema = Joi.object<ConsentSessionAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    audiences: Joi.array().items(Joi.string().guid()).required(),
    clientId: Joi.string().guid().required(),
    identityId: Joi.string().guid().required(),
    scopes: Joi.array().items(Joi.string().lowercase()).required(),
    sessions: Joi.array().items(Joi.string().guid()).required(),
  })
  .required();

export class ConsentSession extends LindormEntity<ConsentSessionAttributes> {
  public readonly clientId: string;
  public readonly identityId: string;

  public audiences: Array<string>;
  public scopes: Array<string>;
  public sessions: Array<string>;

  public constructor(options: ConsentSessionOptions) {
    super(options);

    this.audiences = options.audiences || [];
    this.clientId = options.clientId;
    this.identityId = options.identityId;
    this.scopes = options.scopes || [];
    this.sessions = options.sessions || [];
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): ConsentSessionAttributes {
    return {
      ...this.defaultJSON(),

      audiences: this.audiences,
      clientId: this.clientId,
      identityId: this.identityId,
      scopes: this.scopes,
      sessions: this.sessions,
    };
  }
}
