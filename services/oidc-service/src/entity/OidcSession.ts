import Joi from "joi";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";
import { JOI_GUID } from "../common";

export interface OidcSessionAttributes extends EntityAttributes {
  callbackUri: string;
  codeVerifier: string | null;
  expires: Date;
  identityId: string | null;
  nonce: string;
  provider: string;
  state: string;
  verified: boolean;
}

export type OidcSessionOptions = Optional<
  OidcSessionAttributes,
  EntityKeys | "identityId" | "nonce" | "codeVerifier" | "verified"
>;

const schema = Joi.object<OidcSessionAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    callbackUri: Joi.string().uri().required(),
    codeVerifier: Joi.string().required(),
    expires: Joi.date().required(),
    identityId: JOI_GUID.allow(null).required(),
    nonce: Joi.string().required(),
    provider: Joi.string().required(),
    state: Joi.string().required(),
    verified: Joi.boolean().required(),
  })
  .required();

export class OidcSession
  extends LindormEntity<OidcSessionAttributes>
  implements OidcSessionAttributes
{
  public callbackUri: string;
  public codeVerifier: string;
  public expires: Date;
  public identityId: string | null;
  public nonce: string;
  public provider: string;
  public state: string;
  public verified: boolean;

  public constructor(options: OidcSessionOptions) {
    super(options);

    this.callbackUri = options.callbackUri;
    this.codeVerifier = options.codeVerifier || null;
    this.expires = options.expires;
    this.identityId = options.identityId || null;
    this.nonce = options.nonce;
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

  public toJSON(): OidcSessionAttributes {
    return {
      ...this.defaultJSON(),

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
