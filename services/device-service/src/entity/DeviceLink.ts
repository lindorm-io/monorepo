import Joi from "joi";
import { CertificateMethod } from "../enum";
import { DeviceMetadata } from "../types";
import { JOI_CERTIFICATE_METHOD, JOI_DEVICE_METADATA } from "../constant";
import { JOI_GUID } from "../common";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export interface DeviceLinkAttributes extends EntityAttributes {
  active: boolean;
  biometry: string | null;
  certificateMethod: CertificateMethod;
  deviceMetadata: DeviceMetadata;
  fingerprint: string;
  identityId: string;
  installationId: string;
  name: string | null;
  pincode: string | null;
  publicKey: string;
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
    biometry: Joi.string().base64().allow(null).required(),
    certificateMethod: JOI_CERTIFICATE_METHOD.required(),
    deviceMetadata: JOI_DEVICE_METADATA.required(),
    fingerprint: Joi.string().required(),
    identityId: JOI_GUID.required(),
    installationId: JOI_GUID.required(),
    name: Joi.string().allow(null).required(),
    pincode: Joi.string().base64().allow(null).required(),
    publicKey: Joi.string().required(),
    trusted: Joi.boolean().required(),
    uniqueId: JOI_GUID.required(),
  })
  .required();

export class DeviceLink extends LindormEntity<DeviceLinkAttributes> {
  public readonly certificateMethod: CertificateMethod;
  public readonly deviceMetadata: DeviceMetadata;
  public readonly fingerprint: string;
  public readonly identityId: string;
  public readonly installationId: string;
  public readonly publicKey: string;
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
    this.deviceMetadata = options.deviceMetadata;
    this.fingerprint = options.fingerprint;
    this.identityId = options.identityId;
    this.installationId = options.installationId;
    this.name = options.name || null;
    this.pincode = options.pincode || null;
    this.publicKey = options.publicKey;
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
      deviceMetadata: this.deviceMetadata,
      fingerprint: this.fingerprint,
      identityId: this.identityId,
      installationId: this.installationId,
      name: this.name,
      pincode: this.pincode,
      publicKey: this.publicKey,
      trusted: this.trusted,
      uniqueId: this.uniqueId,
    };
  }
}
