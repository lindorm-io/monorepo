import Joi from "joi";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export type TenantAttributes = EntityAttributes & {
  active: boolean;
  administrators: Array<string>;
  name: string;
  owner: string;
  subdomain: string;
};

export type TenantOptions = Optional<TenantAttributes, EntityKeys>;

const schema = Joi.object<TenantAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    active: Joi.boolean().required(),
    administrators: Joi.array().items(Joi.string()).required(),
    name: Joi.string().required(),
    owner: Joi.string().required(),
    subdomain: Joi.string().required(),
  })
  .required();

export class Tenant extends LindormEntity<TenantAttributes> {
  public active: boolean;
  public administrators: Array<string>;
  public name: string;
  public owner: string;
  public subdomain: string;

  public constructor(options: TenantOptions) {
    super(options);

    this.active = options.active === true;
    this.administrators = options.administrators;
    this.name = options.name;
    this.owner = options.owner;
    this.subdomain = options.subdomain;
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): TenantAttributes {
    return {
      ...this.defaultJSON(),

      active: this.active,
      administrators: this.administrators,
      name: this.name,
      owner: this.owner,
      subdomain: this.subdomain,
    };
  }
}
