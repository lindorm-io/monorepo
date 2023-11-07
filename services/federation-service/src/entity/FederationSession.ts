import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";
import Joi from "joi";

export type FederationSessionAttributes = EntityAttributes & {
  callbackId: string;
  callbackUri: string;
  codeVerifier: string | null;
  expires: Date;
  identityId: string | null;
  nonce: string | null;
  provider: string;
  state: string;
  verified: boolean;
};

export type FederationSessionOptions = Optional<
  FederationSessionAttributes,
  EntityKeys | "identityId" | "nonce" | "codeVerifier" | "verified"
>;

const schema = Joi.object<FederationSessionAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    callbackId: Joi.string().guid().required(),
    callbackUri: Joi.string().uri().required(),
    codeVerifier: Joi.string().required(),
    expires: Joi.date().required(),
    identityId: Joi.string().guid().allow(null).required(),
    nonce: Joi.string().required(),
    provider: Joi.string().required(),
    state: Joi.string().required(),
    verified: Joi.boolean().required(),
  })
  .required();

export class FederationSession
  extends LindormEntity<FederationSessionAttributes>
  implements FederationSessionAttributes
{
  public callbackId: string;
  public callbackUri: string;
  public codeVerifier: string | null;
  public expires: Date;
  public identityId: string | null;
  public nonce: string | null;
  public provider: string;
  public state: string;
  public verified: boolean;

  public constructor(options: FederationSessionOptions) {
    super(options);

    this.callbackId = options.callbackId;
    this.callbackUri = options.callbackUri;
    this.codeVerifier = options.codeVerifier || null;
    this.expires = options.expires;
    this.identityId = options.identityId || null;
    this.nonce = options.nonce || null;
    this.provider = options.provider;
    this.state = options.state;
    this.state = options.state;
    this.verified = options.verified === true;
  }

  public create(): void {
    /* intentionally left empty */
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): FederationSessionAttributes {
    return {
      ...this.defaultJSON(),

      callbackId: this.callbackId,
      callbackUri: this.callbackUri,
      codeVerifier: this.codeVerifier,
      expires: this.expires,
      identityId: this.identityId,
      nonce: this.nonce,
      provider: this.provider,
      state: this.state,
      verified: this.verified,
    };
  }
}
