import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
} from "@lindorm-io/common-enums";
import { LevelOfAssurance } from "@lindorm-io/common-types";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";
import Joi from "joi";
import { JOI_LEVEL_OF_ASSURANCE } from "../common";

export type BrowserSessionAttributes = EntityAttributes & {
  factors: Array<AuthenticationFactor>;
  identityId: string;
  latestAuthentication: Date;
  levelOfAssurance: LevelOfAssurance;
  metadata: Record<string, any>;
  methods: Array<AuthenticationMethod>;
  remember: boolean;
  singleSignOn: boolean;
  strategies: Array<AuthenticationStrategy>;
};

export type BrowserSessionOptions = Optional<BrowserSessionAttributes, EntityKeys>;

const schema = Joi.object<BrowserSessionAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    factors: Joi.array().items(Joi.string().lowercase()).required(),
    identityId: Joi.string().guid().required(),
    latestAuthentication: Joi.date().required(),
    levelOfAssurance: JOI_LEVEL_OF_ASSURANCE.required(),
    metadata: Joi.object().required(),
    methods: Joi.array().items(Joi.string().lowercase()).required(),
    remember: Joi.boolean().required(),
    singleSignOn: Joi.boolean().required(),
    strategies: Joi.array().items(Joi.string().lowercase()).required(),
  })
  .required();

export class BrowserSession extends LindormEntity<BrowserSessionAttributes> {
  public readonly identityId: string;
  public readonly metadata: Record<string, any>;

  public factors: Array<AuthenticationFactor>;
  public latestAuthentication: Date;
  public levelOfAssurance: LevelOfAssurance;
  public methods: Array<AuthenticationMethod>;
  public remember: boolean;
  public singleSignOn: boolean;
  public strategies: Array<AuthenticationStrategy>;

  public constructor(options: BrowserSessionOptions) {
    super(options);

    this.factors = options.factors;
    this.identityId = options.identityId;
    this.latestAuthentication = options.latestAuthentication;
    this.levelOfAssurance = options.levelOfAssurance;
    this.metadata = options.metadata || {};
    this.methods = options.methods;
    this.remember = options.remember === true;
    this.singleSignOn = options.singleSignOn === true;
    this.strategies = options.strategies;
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): BrowserSessionAttributes {
    return {
      ...this.defaultJSON(),

      factors: this.factors,
      identityId: this.identityId,
      latestAuthentication: this.latestAuthentication,
      levelOfAssurance: this.levelOfAssurance,
      metadata: this.metadata,
      methods: this.methods,
      remember: this.remember,
      singleSignOn: this.singleSignOn,
      strategies: this.strategies,
    };
  }
}
