import { CertificateMethod } from "@lindorm-io/common-enums";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";
import Joi from "joi";
import { JOI_CERTIFICATE_METHOD, JOI_DEVICE_METADATA } from "../constant";
import { DeviceMetadata } from "../types";

export interface DeviceLinkAttributes extends EntityAttributes {
  active: boolean;
  biometry: string | null;
  certificateMethod: CertificateMethod;
  metadata: DeviceMetadata;
  identityId: string;
  installationId: string;
  name: string | null;
  pincode: string | null;
  publicKeyId: string;
  trusted: boolean;
  uniqueId: string;
}

export type DeviceLinkOptions = Optional<
  DeviceLinkAttributes,
  EntityKeys | "active" | "biometry" | "pincode" | "trusted"
>;

const schema = Joi.object<DeviceLinkAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    active: Joi.boolean().required(),
    biometry: Joi.string().allow(null).required(),
    certificateMethod: JOI_CERTIFICATE_METHOD.required(),
    identityId: Joi.string().guid().required(),
    installationId: Joi.string().guid().required(),
    metadata: JOI_DEVICE_METADATA.required(),
    name: Joi.string().allow(null).required(),
    pincode: Joi.string().allow(null).required(),
    publicKeyId: Joi.string().guid().required(),
    trusted: Joi.boolean().required(),
    uniqueId: Joi.string().required(),
  })
  .required();

export class DeviceLink extends LindormEntity<DeviceLinkAttributes> {
  public readonly certificateMethod: CertificateMethod;
  public readonly identityId: string;
  public readonly installationId: string;
  public readonly metadata: DeviceMetadata;
  public readonly publicKeyId: string;
  public readonly uniqueId: string;

  public active: boolean;
  public biometry: string | null;
  public name: string | null;
  public pincode: string | null;
  public trusted: boolean;

  public constructor(options: DeviceLinkOptions) {
    super(options);

    this.active = options.active === true;
    this.biometry = options.biometry || null;
    this.certificateMethod = options.certificateMethod;
    this.identityId = options.identityId;
    this.installationId = options.installationId;
    this.metadata = options.metadata;
    this.name = options.name || null;
    this.pincode = options.pincode || null;
    this.publicKeyId = options.publicKeyId;
    this.trusted = options.trusted === true;
    this.uniqueId = options.uniqueId;
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): DeviceLinkAttributes {
    return {
      ...this.defaultJSON(),

      active: this.active,
      biometry: this.biometry,
      certificateMethod: this.certificateMethod,
      identityId: this.identityId,
      installationId: this.installationId,
      metadata: this.metadata,
      name: this.name,
      pincode: this.pincode,
      publicKeyId: this.publicKeyId,
      trusted: this.trusted,
      uniqueId: this.uniqueId,
    };
  }
}
