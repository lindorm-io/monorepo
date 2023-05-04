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
  token: string;
  type: OpaqueTokenType;
};

export type OpaqueTokenOptions = Optional<OpaqueTokenAttributes, EntityKeys>;

const schema = Joi.object<OpaqueTokenAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    clientSessionId: Joi.string().guid().required(),
    expires: Joi.date().required(),
    token: Joi.string().length(215).required(),
    type: Joi.string()
      .valid(...Object.values(OpaqueTokenType))
      .required(),
  })
  .required();

export class OpaqueToken extends LindormEntity<OpaqueTokenAttributes> {
  public readonly clientSessionId: string;
  public readonly expires: Date;
  public readonly token: string;
  public readonly type: OpaqueTokenType;

  public constructor(options: OpaqueTokenOptions) {
    super(options);

    this.clientSessionId = options.clientSessionId;
    this.expires = options.expires;
    this.token = options.token;
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
      token: this.token,
      type: this.type,
    };
  }
}
