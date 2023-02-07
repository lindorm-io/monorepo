import Joi from "joi";
import { JOI_CERTIFICATE_CHALLENGE, JOI_STRATEGY } from "../constant";
import { JOI_NONCE } from "../common";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";
import { ChallengeStrategy } from "@lindorm-io/common-types";

export interface ChallengeSessionAttributes extends EntityAttributes {
  audiences: Array<string>;
  certificateChallenge: string;
  deviceLinkId: string;
  expires: Date;
  nonce: string;
  payload: Record<string, any>;
  scopes: Array<string>;
  strategies: Array<ChallengeStrategy>;
}

export type ChallengeSessionOptions = Optional<
  ChallengeSessionAttributes,
  EntityKeys | "audiences"
>;

const schema = Joi.object<ChallengeSessionAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    audiences: Joi.array().items(Joi.string().guid()).required(),
    certificateChallenge: JOI_CERTIFICATE_CHALLENGE.required(),
    deviceLinkId: Joi.string().guid().required(),
    expires: Joi.date().required(),
    nonce: JOI_NONCE.required(),
    payload: Joi.object().required(),
    scopes: Joi.array().items(Joi.string()).required(),
    strategies: Joi.array().items(JOI_STRATEGY).required(),
  })
  .required();

export class ChallengeSession extends LindormEntity<ChallengeSessionAttributes> {
  public readonly audiences: Array<string>;
  public readonly certificateChallenge: string;
  public readonly deviceLinkId: string;
  public readonly expires: Date;
  public readonly nonce: string;
  public readonly payload: Record<string, any>;
  public readonly scopes: Array<string>;
  public readonly strategies: Array<ChallengeStrategy>;

  public constructor(options: ChallengeSessionOptions) {
    super(options);

    this.audiences = options.audiences || [];
    this.certificateChallenge = options.certificateChallenge;
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

      audiences: this.audiences,
      certificateChallenge: this.certificateChallenge,
      deviceLinkId: this.deviceLinkId,
      expires: this.expires,
      nonce: this.nonce,
      payload: this.payload,
      scopes: this.scopes,
      strategies: this.strategies,
    };
  }
}
