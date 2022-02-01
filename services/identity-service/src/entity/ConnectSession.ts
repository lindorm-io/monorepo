import Joi from "joi";
import { JOI_ARGON_STRING, JOI_EMAIL, JOI_GUID } from "../common";
import { JOI_IDENTIFIER_TYPE } from "../constant";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export interface ConnectSessionAttributes extends EntityAttributes {
  code: string;
  identifier: string;
  identityId: string;
  type: string;
}

export type ConnectSessionOptions = Optional<ConnectSessionAttributes, EntityKeys>;

const schema = Joi.object<ConnectSessionAttributes>({
  ...JOI_ENTITY_BASE,

  code: JOI_ARGON_STRING.required(),
  identifier: JOI_EMAIL.required(),
  identityId: JOI_GUID.required(),
  type: JOI_IDENTIFIER_TYPE.required(),
});

export class ConnectSession extends LindormEntity<ConnectSessionAttributes> {
  public readonly code: string;
  public readonly identifier: string;
  public readonly identityId: string;
  public readonly type: string;

  public constructor(options: ConnectSessionOptions) {
    super(options);

    this.code = options.code;
    this.identifier = options.identifier;
    this.identityId = options.identityId;
    this.type = options.type;
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): ConnectSessionAttributes {
    return {
      ...this.defaultJSON(),

      code: this.code,
      identifier: this.identifier,
      identityId: this.identityId,
      type: this.type,
    };
  }
}
