import {
  AuthenticationMethod,
  LevelOfAssurance,
  LindormScope,
  OpenIdScope,
} from "@lindorm-io/common-types";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";
import { randomUnreserved } from "@lindorm-io/random";
import Joi from "joi";
import { JOI_LEVEL_OF_ASSURANCE, JOI_NONCE } from "../common";
import { ClientSessionType } from "../enum";

export type ClientSessionAttributes = EntityAttributes & {
  audiences: Array<string>;
  browserSessionId: string | null;
  clientId: string;
  identityId: string;
  latestAuthentication: Date;
  levelOfAssurance: LevelOfAssurance;
  metadata: Record<string, any>;
  methods: Array<AuthenticationMethod>;
  nonce: string;
  scopes: Array<OpenIdScope | LindormScope>;
  tenantId: string;
  type: ClientSessionType;
};

export type ClientSessionOptions = Optional<
  ClientSessionAttributes,
  | EntityKeys
  | "audiences"
  | "browserSessionId"
  | "latestAuthentication"
  | "metadata"
  | "nonce"
  | "scopes"
>;

const schema = Joi.object<ClientSessionAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    audiences: Joi.array().items(Joi.string().guid()).required(),
    browserSessionId: Joi.string().guid().allow(null).required(),
    clientId: Joi.string().guid().required(),
    identityId: Joi.string().guid().required(),
    latestAuthentication: Joi.date().required(),
    levelOfAssurance: JOI_LEVEL_OF_ASSURANCE.required(),
    metadata: Joi.object().required(),
    methods: Joi.array().items(Joi.string().lowercase()).required(),
    nonce: JOI_NONCE.required(),
    scopes: Joi.array().items(Joi.string().lowercase()).required(),
    tenantId: Joi.string().guid().required(),
    type: Joi.string()
      .valid(...Object.values(ClientSessionType))
      .required(),
  })
  .required();

export class ClientSession extends LindormEntity<ClientSessionAttributes> {
  public readonly browserSessionId: string | null;
  public readonly clientId: string;
  public readonly identityId: string;
  public readonly metadata: Record<string, any>;
  public readonly tenantId: string;

  public audiences: Array<string>;
  public latestAuthentication: Date;
  public levelOfAssurance: LevelOfAssurance;
  public methods: Array<AuthenticationMethod>;
  public nonce: string;
  public scopes: Array<OpenIdScope | LindormScope>;
  public type: ClientSessionType;

  public constructor(options: ClientSessionOptions) {
    super(options);

    this.audiences = options.audiences || [];
    this.browserSessionId = options.browserSessionId || null;
    this.clientId = options.clientId;
    this.identityId = options.identityId;
    this.latestAuthentication = options.latestAuthentication || new Date();
    this.levelOfAssurance = options.levelOfAssurance;
    this.metadata = options.metadata || {};
    this.methods = options.methods;
    this.nonce = options.nonce || randomUnreserved(16);
    this.scopes = options.scopes || [];
    this.tenantId = options.tenantId;
    this.type = options.type;
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): ClientSessionAttributes {
    return {
      ...this.defaultJSON(),

      audiences: this.audiences,
      browserSessionId: this.browserSessionId,
      clientId: this.clientId,
      identityId: this.identityId,
      latestAuthentication: this.latestAuthentication,
      levelOfAssurance: this.levelOfAssurance,
      metadata: this.metadata,
      methods: this.methods,
      nonce: this.nonce,
      scopes: this.scopes,
      tenantId: this.tenantId,
      type: this.type,
    };
  }
}
