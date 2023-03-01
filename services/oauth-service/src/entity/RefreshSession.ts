import Joi from "joi";
import {
  AuthenticationMethod,
  LevelOfAssurance,
  LindormScope,
  OpenIdScope,
} from "@lindorm-io/common-types";
import { JOI_LEVEL_OF_ASSURANCE, JOI_NONCE } from "../common";
import { randomString } from "@lindorm-io/random";
import { randomUUID } from "crypto";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export type RefreshSessionAttributes = EntityAttributes & {
  audiences: Array<string>;
  browserSessionId: string;
  clientId: string;
  expires: Date;
  identityId: string;
  latestAuthentication: Date;
  levelOfAssurance: LevelOfAssurance;
  metadata: Record<string, any>;
  methods: Array<AuthenticationMethod>;
  nonce: string;
  refreshTokenId: string;
  scopes: Array<OpenIdScope | LindormScope>;
};

export type RefreshSessionOptions = Optional<
  RefreshSessionAttributes,
  EntityKeys | "refreshTokenId"
>;

const schema = Joi.object<RefreshSessionAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    audiences: Joi.array().items(Joi.string().guid()).required(),
    browserSessionId: Joi.string().guid().required(),
    clientId: Joi.string().guid().required(),
    expires: Joi.date().required(),
    identityId: Joi.string().guid().required(),
    latestAuthentication: Joi.date().required(),
    levelOfAssurance: JOI_LEVEL_OF_ASSURANCE.required(),
    metadata: Joi.object().required(),
    methods: Joi.array().items(Joi.string().lowercase()).required(),
    nonce: JOI_NONCE.required(),
    refreshTokenId: Joi.string().guid().required(),
    scopes: Joi.array().items(Joi.string().lowercase()).required(),
  })
  .required();

export class RefreshSession extends LindormEntity<RefreshSessionAttributes> {
  public readonly browserSessionId: string;
  public readonly clientId: string;
  public readonly identityId: string;
  public readonly metadata: Record<string, any>;

  public audiences: Array<string>;
  public expires: Date;
  public latestAuthentication: Date;
  public levelOfAssurance: LevelOfAssurance;
  public methods: Array<AuthenticationMethod>;
  public nonce: string;
  public refreshTokenId: string;
  public scopes: Array<OpenIdScope | LindormScope>;

  public constructor(options: RefreshSessionOptions) {
    super(options);

    this.audiences = options.audiences || [];
    this.browserSessionId = options.browserSessionId;
    this.clientId = options.clientId;
    this.expires = options.expires;
    this.identityId = options.identityId;
    this.latestAuthentication = options.latestAuthentication || new Date();
    this.levelOfAssurance = options.levelOfAssurance;
    this.metadata = options.metadata || {};
    this.methods = options.methods;
    this.nonce = options.nonce || randomString(16);
    this.refreshTokenId = options.refreshTokenId || randomUUID();
    this.scopes = options.scopes || [];
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): RefreshSessionAttributes {
    return {
      ...this.defaultJSON(),

      audiences: this.audiences,
      browserSessionId: this.browserSessionId,
      clientId: this.clientId,
      expires: this.expires,
      identityId: this.identityId,
      latestAuthentication: this.latestAuthentication,
      levelOfAssurance: this.levelOfAssurance,
      metadata: this.metadata,
      methods: this.methods,
      nonce: this.nonce,
      refreshTokenId: this.refreshTokenId,
      scopes: this.scopes,
    };
  }
}
