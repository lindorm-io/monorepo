import Joi from "joi";
import { JOI_GUID } from "../common";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export interface ConsentSessionAttributes extends EntityAttributes {
  audiences: Array<string>;
  clientId: string;
  identityId: string;
  scopes: Array<string>;
  sessions: Array<string>;
}

export type ConsentSessionOptions = Optional<
  ConsentSessionAttributes,
  EntityKeys | "audiences" | "scopes" | "sessions"
>;

const schema = Joi.object<ConsentSessionAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    audiences: Joi.array().items(JOI_GUID).required(),
    clientId: JOI_GUID.required(),
    identityId: JOI_GUID.required(),
    scopes: Joi.array().items(Joi.string().lowercase()).required(),
    sessions: Joi.array().items(JOI_GUID).required(),
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
