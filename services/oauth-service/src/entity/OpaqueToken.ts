import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";
import Joi from "joi";
import { OpaqueTokenType } from "../enum";

export type OpaqueTokenAttributes = EntityAttributes & {
  clientSessionId: string;
  expires: Date;
  roles: Array<string>;
  signature: string;
  type: OpaqueTokenType;
};

export type OpaqueTokenOptions = Optional<OpaqueTokenAttributes, EntityKeys | "roles">;

const schema = Joi.object<OpaqueTokenAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    clientSessionId: Joi.string().guid().required(),
    expires: Joi.date().required(),
    roles: Joi.array().items(Joi.string()).required(),
    signature: Joi.string().min(128).required(),
    type: Joi.string()
      .valid(...Object.values(OpaqueTokenType))
      .required(),
  })
  .required();

export class OpaqueToken extends LindormEntity<OpaqueTokenAttributes> {
  public readonly clientSessionId: string;
  public readonly expires: Date;
  public readonly roles: Array<string>;
  public readonly signature: string;
  public readonly type: OpaqueTokenType;

  public constructor(options: OpaqueTokenOptions) {
    super(options);

    this.clientSessionId = options.clientSessionId;
    this.expires = options.expires;
    this.roles = options.roles ?? [];
    this.signature = options.signature;
    this.type = options.type;
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): OpaqueTokenAttributes {
    return {
      ...this.defaultJSON(),

      clientSessionId: this.clientSessionId,
      expires: this.expires,
      roles: this.roles,
      signature: this.signature,
      type: this.type,
    };
  }
}
