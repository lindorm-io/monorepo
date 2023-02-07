import Joi from "joi";
import { IdentityAddress } from "../types";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export type AddressAttributes = EntityAttributes & {
  careOf: string | null;
  country: string | null;
  identityId: string;
  label: string | null;
  locality: string | null;
  postalCode: string | null;
  primary: boolean;
  region: string | null;
  streetAddress: Array<string>;
};

export type AddressOptions = Optional<AddressAttributes, EntityKeys | "label">;

const schema = Joi.object<AddressAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    careOf: Joi.string().allow(null).required(),
    country: Joi.string().allow(null).required(),
    identityId: Joi.string().guid().required(),
    label: Joi.string().allow(null).required(),
    locality: Joi.string().allow(null).required(),
    postalCode: Joi.string().allow(null).required(),
    primary: Joi.boolean().required(),
    region: Joi.string().allow(null).required(),
    streetAddress: Joi.array().items(Joi.string()).required(),
  })
  .required();

export class Address extends LindormEntity<AddressAttributes> implements IdentityAddress {
  public readonly identityId: string;

  public careOf: string;
  public country: string;
  public label: string | null;
  public locality: string;
  public postalCode: string;
  public primary: boolean;
  public region: string;
  public streetAddress: Array<string>;

  public constructor(options: AddressOptions) {
    super(options);

    this.careOf = options.careOf || null;
    this.country = options.country || null;
    this.identityId = options.identityId;
    this.label = options.label || null;
    this.locality = options.locality || null;
    this.postalCode = options.postalCode || null;
    this.primary = options.primary;
    this.region = options.region || null;
    this.streetAddress = options.streetAddress || [];
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): AddressAttributes {
    return {
      ...this.defaultJSON(),

      careOf: this.careOf,
      country: this.country,
      identityId: this.identityId,
      label: this.label,
      locality: this.locality,
      postalCode: this.postalCode,
      primary: this.primary,
      region: this.region,
      streetAddress: this.streetAddress,
    };
  }
}
