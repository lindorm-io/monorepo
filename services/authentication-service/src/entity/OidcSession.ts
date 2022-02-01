import Joi from "joi";
import { JOI_GUID } from "../common";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export interface OidcSessionAttributes extends EntityAttributes {
  codeVerifier: string | null;
  expires: Date;
  identityProvider: string | null;
  loginSessionId: string;
  nonce: string | null;
  redirectUri: string | null;
  scope: string | null;
  state: string | null;
}

export type OidcSessionOptions = Optional<OidcSessionAttributes, EntityKeys>;

const schema = Joi.object<OidcSessionAttributes>({
  ...JOI_ENTITY_BASE,

  codeVerifier: Joi.string().required(),
  expires: Joi.date().required(),
  identityProvider: Joi.string().required(),
  loginSessionId: JOI_GUID.required(),
  nonce: Joi.string().required(),
  redirectUri: Joi.string().uri().required(),
  scope: Joi.string().required(),
  state: Joi.string().required(),
});

export class OidcSession
  extends LindormEntity<OidcSessionAttributes>
  implements OidcSessionAttributes
{
  public readonly loginSessionId: string;

  public codeVerifier: string;
  public expires: Date;
  public identityProvider: string;
  public nonce: string;
  public redirectUri: string;
  public scope: string;
  public state: string;

  public constructor(options: OidcSessionOptions) {
    super(options);

    this.codeVerifier = options.codeVerifier || null;
    this.expires = options.expires;
    this.identityProvider = options.identityProvider || null;
    this.loginSessionId = options.loginSessionId;
    this.nonce = options.nonce || null;
    this.redirectUri = options.redirectUri || null;
    this.scope = options.scope || null;
    this.state = options.state || null;
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

      codeVerifier: this.codeVerifier,
      expires: this.expires,
      identityProvider: this.identityProvider,
      loginSessionId: this.loginSessionId,
      nonce: this.nonce,
      redirectUri: this.redirectUri,
      scope: this.scope,
      state: this.state,
    };
  }
}
