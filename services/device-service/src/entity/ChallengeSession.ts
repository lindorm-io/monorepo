import Joi from "joi";
import { JOI_CERTIFICATE_CHALLENGE, JOI_STRATEGY } from "../constant";
import { JOI_GUID, JOI_NONCE, ChallengeStrategy } from "../common";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export interface ChallengeSessionAttributes extends EntityAttributes {
  certificateChallenge: string;
  clientId: string;
  deviceLinkId: string;
  expires: Date;
  nonce: string;
  payload: Record<string, any>;
  scopes: Array<string>;
  strategies: Array<ChallengeStrategy>;
}

export type ChallengeSessionOptions = Optional<ChallengeSessionAttributes, EntityKeys>;

const schema = Joi.object<ChallengeSessionAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    certificateChallenge: JOI_CERTIFICATE_CHALLENGE.required(),
    clientId: JOI_GUID.required(),
    deviceLinkId: JOI_GUID.required(),
    expires: Joi.date().required(),
    nonce: JOI_NONCE.required(),
    payload: Joi.object().required(),
    scopes: Joi.array().items(Joi.string()).required(),
    strategies: Joi.array().items(JOI_STRATEGY).required(),
  })
  .required();

export class ChallengeSession extends LindormEntity<ChallengeSessionAttributes> {
  public readonly certificateChallenge: string;
  public readonly clientId: string;
  public readonly deviceLinkId: string;
  public readonly expires: Date;
  public readonly nonce: string;
  public readonly payload: Record<string, any>;
  public readonly scopes: Array<string>;
  public readonly strategies: Array<ChallengeStrategy>;

  public constructor(options: ChallengeSessionOptions) {
    super(options);

    this.certificateChallenge = options.certificateChallenge;
    this.clientId = options.clientId;
    this.deviceLinkId = options.deviceLinkId;
    this.expires = options.expires;
    this.nonce = options.nonce;
    this.payload = options.payload;
    this.scopes = options.scopes;
    this.strategies = options.strategies;
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): ChallengeSessionAttributes {
    return {
      ...this.defaultJSON(),

      certificateChallenge: this.certificateChallenge,
      clientId: this.clientId,
      deviceLinkId: this.deviceLinkId,
      expires: this.expires,
      nonce: this.nonce,
      payload: this.payload,
      scopes: this.scopes,
      strategies: this.strategies,
    };
  }
}
