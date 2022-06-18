import Joi from "joi";
import { CertificateMethod } from "../enum";
import { DeviceMetadata } from "../types";
import { JOI_NONCE, JOI_SESSION_STATUS } from "../common";
import { SessionStatus } from "../common";
import {
  JOI_CERTIFICATE_CHALLENGE,
  JOI_CERTIFICATE_METHOD,
  JOI_DEVICE_METADATA,
} from "../constant";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export interface EnrolmentSessionAttributes extends EntityAttributes {
  certificateChallenge: string;
  certificateMethod: CertificateMethod;
  deviceMetadata: DeviceMetadata;
  expires: Date;
  fingerprint: string | null;
  identityId: string;
  installationId: string;
  name: string | null;
  nonce: string;
  publicKey: string;
  status: SessionStatus;
  uniqueId: string;
}

export type EnrolmentSessionOptions = Optional<EnrolmentSessionAttributes, EntityKeys>;

const schema = Joi.object<EnrolmentSessionAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    certificateChallenge: JOI_CERTIFICATE_CHALLENGE.required(),
    certificateMethod: JOI_CERTIFICATE_METHOD.required(),
    deviceMetadata: JOI_DEVICE_METADATA.required(),
    expires: Joi.date().required(),
    fingerprint: Joi.string().allow(null).required(),
    identityId: Joi.string().guid().required(),
    uniqueId: Joi.string().required(),
    installationId: Joi.string().guid().required(),
    name: Joi.string().allow(null).required(),
    nonce: JOI_NONCE.required(),
    publicKey: Joi.string().required(),
    status: JOI_SESSION_STATUS.required(),
  })
  .required();

export class EnrolmentSession extends LindormEntity<EnrolmentSessionAttributes> {
  public readonly certificateChallenge: string;
  public readonly certificateMethod: CertificateMethod;
  public readonly deviceMetadata: DeviceMetadata;
  public readonly expires: Date;
  public readonly fingerprint: string | null;
  public readonly identityId: string;
  public readonly installationId: string;
  public readonly name: string | null;
  public readonly nonce: string;
  public readonly publicKey: string;
  public readonly uniqueId: string;

  public status: SessionStatus;

  public constructor(options: EnrolmentSessionOptions) {
    super(options);

    this.certificateChallenge = options.certificateChallenge;
    this.certificateMethod = options.certificateMethod;
    this.deviceMetadata = options.deviceMetadata;
    this.expires = options.expires;
    this.fingerprint = options.fingerprint || null;
    this.identityId = options.identityId;
    this.installationId = options.installationId;
    this.name = options.name || null;
    this.nonce = options.nonce;
    this.publicKey = options.publicKey;
    this.status = options.status;
    this.uniqueId = options.uniqueId;
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): EnrolmentSessionAttributes {
    return {
      ...this.defaultJSON(),

      certificateChallenge: this.certificateChallenge,
      certificateMethod: this.certificateMethod,
      deviceMetadata: this.deviceMetadata,
      expires: this.expires,
      fingerprint: this.fingerprint,
      identityId: this.identityId,
      installationId: this.installationId,
      name: this.name,
      nonce: this.nonce,
      publicKey: this.publicKey,
      status: this.status,
      uniqueId: this.uniqueId,
    };
  }
}
