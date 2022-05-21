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

const schema = Joi.object<DeviceLinkAttributes>({
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
});

export class DeviceLink extends LindormEntity<DeviceLinkAttributes> {
  public readonly certificateMethod: CertificateMethod;
  public readonly deviceMetadata: DeviceMetadata;
  public readonly fingerprint: string;
  public readonly identityId: string;
  public readonly installationId: string;
  public readonly publicKey: string;
  public readonly uniqueId: string;

  private _active: boolean;
  private _biometry: string | null;
  private _name: string | null;
  private _pincode: string | null;
  private _trusted: boolean;

  public constructor(options: DeviceLinkOptions) {
    super(options);

    this.certificateMethod = options.certificateMethod;
    this.deviceMetadata = options.deviceMetadata;
    this.fingerprint = options.fingerprint;
    this.identityId = options.identityId;
    this.installationId = options.installationId;
    this.publicKey = options.publicKey;
    this.uniqueId = options.uniqueId;

    this._active = options.active === true;
    this._biometry = options.biometry || null;
    this._name = options.name || null;
    this._pincode = options.pincode || null;
    this._trusted = options.trusted === true;
  }

  public get active(): boolean {
    return this._active;
  }
  public set active(active: boolean) {
    this._active = active;
    this.updated = new Date();
  }

  public get biometry(): string | null {
    return this._biometry;
  }
  public set biometry(biometry: string | null) {
    this._biometry = biometry;
    this.updated = new Date();
  }

  public get name(): string | null {
    return this._name;
  }
  public set name(name: string | null) {
    this._name = name;
    this.updated = new Date();
  }

  public get pincode(): string | null {
    return this._pincode;
  }
  public set pincode(pincode: string | null) {
    this._pincode = pincode;
    this.updated = new Date();
  }

  public get trusted(): boolean {
    return this._trusted;
  }
  public set trusted(trusted: boolean) {
    this._trusted = trusted;
    this.updated = new Date();
  }

  public create(): void {
    /* intentionally left empty */
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
