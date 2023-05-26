import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";
import Joi from "joi";

export type TenantAttributes = EntityAttributes & {
  active: boolean;
  name: string;
  owner: string;
  subdomain: string;
  trusted: boolean;
};

export type TenantOptions = Optional<TenantAttributes, EntityKeys>;

const schema = Joi.object<TenantAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    active: Joi.boolean().required(),
    name: Joi.string().required(),
    owner: Joi.string().required(),
    subdomain: Joi.string().required(),
    trusted: Joi.boolean().required(),
  })
  .required();

export class Tenant extends LindormEntity<TenantAttributes> {
  public active: boolean;
  public name: string;
  public owner: string;
  public subdomain: string;
  public trusted: boolean;

  public constructor(options: TenantOptions) {
    super(options);

    this.active = options.active === true;
    this.name = options.name;
    this.owner = options.owner;
    this.subdomain = options.subdomain;
    this.trusted = options.trusted === true;
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): TenantAttributes {
    return {
      ...this.defaultJSON(),

      active: this.active,
      name: this.name,
      owner: this.owner,
      subdomain: this.subdomain,
      trusted: this.trusted,
    };
  }
}
