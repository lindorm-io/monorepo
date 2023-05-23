import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";
import Joi from "joi";
import { JOI_CODE } from "../constant";

export type AuthorizationCodeAttributes = EntityAttributes & {
  AuthorizationRequestId: string;
  code: string;
  expires: Date;
};

export type AuthorizationCodeOptions = Optional<AuthorizationCodeAttributes, EntityKeys>;

const schema = Joi.object<AuthorizationCodeAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    AuthorizationRequestId: Joi.string().guid().required(),
    code: JOI_CODE.required(),
    expires: Joi.date().required(),
  })
  .required();

export class AuthorizationCode extends LindormEntity<AuthorizationCodeAttributes> {
  public readonly AuthorizationRequestId: string;
  public readonly code: string;
  public readonly expires: Date;

  public constructor(options: AuthorizationCodeOptions) {
    super(options);

    this.AuthorizationRequestId = options.AuthorizationRequestId;
    this.code = options.code;
    this.expires = options.expires;
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): AuthorizationCodeAttributes {
    return {
      ...this.defaultJSON(),

      AuthorizationRequestId: this.AuthorizationRequestId,
      code: this.code,
      expires: this.expires,
    };
  }
}
