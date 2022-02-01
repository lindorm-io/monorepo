import Joi from "joi";
import { ClientType, JOI_CLIENT_TYPE, JOI_GUID } from "../common";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export interface LogoutSessionAttributes extends EntityAttributes {
  description: string | null;
  expires: Date;
  logoUri: string | null;
  name: string;
  oauthSessionId: string;
  type: ClientType;
}

export type LogoutSessionOptions = Optional<
  LogoutSessionAttributes,
  EntityKeys | "description" | "logoUri"
>;

const schema = Joi.object<LogoutSessionAttributes>({
  ...JOI_ENTITY_BASE,

  description: Joi.string().allow(null).required(),
  expires: Joi.date().required(),
  logoUri: Joi.string().allow(null).required(),
  name: Joi.string().required(),
  oauthSessionId: JOI_GUID.required(),
  type: JOI_CLIENT_TYPE.required(),
});

export class LogoutSession
  extends LindormEntity<LogoutSessionAttributes>
  implements LogoutSessionAttributes
{
  public readonly description: string;
  public readonly expires: Date;
  public readonly logoUri: string;
  public readonly name: string;
  public readonly oauthSessionId: string;
  public readonly type: ClientType;

  public constructor(options: LogoutSessionOptions) {
    super(options);

    this.description = options.description || null;
    this.expires = options.expires;
    this.logoUri = options.logoUri || null;
    this.name = options.name;
    this.oauthSessionId = options.oauthSessionId;
    this.type = options.type;
  }

  public create(): void {
    /* intentionally left empty */
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): LogoutSessionAttributes {
    return {
      ...this.defaultJSON(),

      description: this.description,
      expires: this.expires,
      logoUri: this.logoUri,
      name: this.name,
      oauthSessionId: this.oauthSessionId,
      type: this.type,
    };
  }
}
