import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";
import Joi from "joi";

export interface ClientAttributes extends EntityAttributes {
  active: boolean;
  name: string | null;
  publicKeyId: string;
}

export type ClientOptions = Optional<ClientAttributes, EntityKeys | "name">;

const schema = Joi.object<ClientAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    active: Joi.boolean().required(),
    name: Joi.string().allow(null).required(),
    publicKeyId: Joi.string().guid().required(),
  })
  .required();

export class Client extends LindormEntity<ClientAttributes> {
  public active: boolean;
  public name: string | null;
  public publicKeyId: string;

  public constructor(options: ClientOptions) {
    super(options);

    this.active = options.active === true;
    this.name = options.name || null;
    this.publicKeyId = options.publicKeyId;
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): ClientAttributes {
    return {
      ...this.defaultJSON(),

      active: this.active,
      name: this.name,
      publicKeyId: this.publicKeyId,
    };
  }
}
