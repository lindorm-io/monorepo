import Joi from "joi";
import { JOI_ARGON_STRING, JOI_GUID } from "../common";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export interface ConnectSessionAttributes extends EntityAttributes {
  code: string;
  expires: Date;
  identifierId: string;
}

export type ConnectSessionOptions = Optional<ConnectSessionAttributes, EntityKeys>;

const schema = Joi.object<ConnectSessionAttributes>({
  ...JOI_ENTITY_BASE,

  code: JOI_ARGON_STRING.required(),
  expires: Joi.date().required(),
  identifierId: JOI_GUID.required(),
});

export class ConnectSession extends LindormEntity<ConnectSessionAttributes> {
  public readonly code: string;
  public readonly expires: Date;
  public readonly identifierId: string;

  public constructor(options: ConnectSessionOptions) {
    super(options);

    this.code = options.code;
    this.expires = options.expires;
    this.identifierId = options.identifierId;
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): ConnectSessionAttributes {
    return {
      ...this.defaultJSON(),

      code: this.code,
      expires: this.expires,
      identifierId: this.identifierId,
    };
  }
}
