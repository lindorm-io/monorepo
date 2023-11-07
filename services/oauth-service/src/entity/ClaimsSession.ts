import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
  LevelOfAssurance,
} from "@lindorm-io/common-types";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";
import Joi from "joi";
import { JOI_LEVEL_OF_ASSURANCE } from "../common";
import { Scope } from "../types";

export type ClaimsSessionAttributes = EntityAttributes & {
  audiences: Array<string>;
  clientId: string;
  expires: Date;
  factors: Array<AuthenticationFactor>;
  identityId: string;
  latestAuthentication: Date;
  levelOfAssurance: LevelOfAssurance;
  metadata: Record<string, any>;
  methods: Array<AuthenticationMethod>;
  scopes: Array<Scope>;
  strategies: Array<AuthenticationStrategy>;
};

export type ClaimsSessionOptions = Optional<ClaimsSessionAttributes, EntityKeys>;

const schema = Joi.object<ClaimsSessionAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    audiences: Joi.array().items(Joi.string().guid()).required(),
    clientId: Joi.string().guid().required(),
    expires: Joi.date().required(),
    factors: Joi.array().items(Joi.string().lowercase()).required(),
    identityId: Joi.string().guid().required(),
    latestAuthentication: Joi.date().required(),
    levelOfAssurance: JOI_LEVEL_OF_ASSURANCE.required(),
    metadata: Joi.object().required(),
    methods: Joi.array().items(Joi.string().lowercase()).required(),
    scopes: Joi.array().items(Joi.string().lowercase()).required(),
    strategies: Joi.array().items(Joi.string().lowercase()).required(),
  })
  .required();

export class ClaimsSession extends LindormEntity<ClaimsSessionAttributes> {
  public readonly audiences: Array<string>;
  public readonly clientId: string;
  public readonly expires: Date;
  public readonly factors: Array<AuthenticationFactor>;
  public readonly identityId: string;
  public readonly latestAuthentication: Date;
  public readonly levelOfAssurance: LevelOfAssurance;
  public readonly metadata: Record<string, any>;
  public readonly methods: Array<AuthenticationMethod>;
  public readonly scopes: Array<Scope>;
  public readonly strategies: Array<AuthenticationStrategy>;

  public constructor(options: ClaimsSessionOptions) {
    super(options);

    this.audiences = options.audiences;
    this.clientId = options.clientId;
    this.expires = options.expires;
    this.factors = options.factors;
    this.identityId = options.identityId;
    this.latestAuthentication = options.latestAuthentication;
    this.levelOfAssurance = options.levelOfAssurance;
    this.metadata = options.metadata;
    this.methods = options.methods;
    this.scopes = options.scopes;
    this.strategies = options.strategies;
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): ClaimsSessionAttributes {
    return {
      ...this.defaultJSON(),

      audiences: this.audiences,
      clientId: this.clientId,
      expires: this.expires,
      factors: this.factors,
      identityId: this.identityId,
      latestAuthentication: this.latestAuthentication,
      levelOfAssurance: this.levelOfAssurance,
      metadata: this.metadata,
      methods: this.methods,
      scopes: this.scopes,
      strategies: this.strategies,
    };
  }
}
