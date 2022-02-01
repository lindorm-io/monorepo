import Joi from "joi";
import {
  ClientType,
  JOI_CLIENT_TYPE,
  JOI_GUID,
  JOI_SCOPE_DESCRIPTION,
  ScopeDescription,
} from "../common";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export interface ConsentSessionAttributes extends EntityAttributes {
  description: string | null;
  expires: Date;
  logoUri: string | null;
  name: string;
  oauthSessionId: string;
  requestedAudiences: Array<string>;
  requestedScopes: Array<string>;
  requiredScopes: Array<string>;
  scopeDescriptions: Array<ScopeDescription>;
  type: ClientType;
}

export type ConsentSessionOptions = Optional<
  ConsentSessionAttributes,
  EntityKeys | "description" | "logoUri"
>;

const schema = Joi.object<ConsentSessionAttributes>({
  ...JOI_ENTITY_BASE,

  description: Joi.string().allow(null).required(),
  expires: Joi.date().required(),
  logoUri: Joi.string().allow(null).required(),
  name: Joi.string().required(),
  oauthSessionId: JOI_GUID.required(),
  requestedAudiences: Joi.array().items(Joi.string()).required(),
  requestedScopes: Joi.array().items(Joi.string()).required(),
  requiredScopes: Joi.array().items(Joi.string()).required(),
  scopeDescriptions: Joi.array().items(JOI_SCOPE_DESCRIPTION).required(),
  type: JOI_CLIENT_TYPE.required(),
});

export class ConsentSession
  extends LindormEntity<ConsentSessionAttributes>
  implements ConsentSessionAttributes
{
  public readonly description: string;
  public readonly expires: Date;
  public readonly logoUri: string;
  public readonly name: string;
  public readonly oauthSessionId: string;
  public readonly requestedAudiences: Array<string>;
  public readonly requestedScopes: Array<string>;
  public readonly requiredScopes: Array<string>;
  public readonly scopeDescriptions: Array<ScopeDescription>;
  public readonly type: ClientType;

  public constructor(options: ConsentSessionOptions) {
    super(options);

    this.description = options.description || null;
    this.expires = options.expires;
    this.logoUri = options.logoUri || null;
    this.name = options.name;
    this.oauthSessionId = options.oauthSessionId;
    this.requestedAudiences = options.requestedAudiences;
    this.requestedScopes = options.requestedScopes;
    this.requiredScopes = options.requiredScopes;
    this.scopeDescriptions = options.scopeDescriptions;
    this.type = options.type;
  }

  public create(): void {
    /* intentionally left empty */
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): ConsentSessionAttributes {
    return {
      ...this.defaultJSON(),

      description: this.description,
      expires: this.expires,
      logoUri: this.logoUri,
      name: this.name,
      oauthSessionId: this.oauthSessionId,
      requestedAudiences: this.requestedAudiences,
      requestedScopes: this.requestedScopes,
      requiredScopes: this.requiredScopes,
      scopeDescriptions: this.scopeDescriptions,
      type: this.type,
    };
  }
}
