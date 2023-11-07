import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
  Dict,
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

export type AuthenticationConfirmationTokenAttributes = EntityAttributes & {
  clientId: string;
  confirmedIdentifiers: Array<string>;
  country: string | null;
  expires: Date;
  factors: Array<AuthenticationFactor>;
  identityId: string;
  levelOfAssurance: LevelOfAssurance;
  maximumLevelOfAssurance: LevelOfAssurance;
  metadata: Dict;
  methods: Array<AuthenticationMethod>;
  nonce: string;
  remember: boolean;
  sessionId: string;
  signature: string;
  singleSignOn: boolean;
  strategies: Array<AuthenticationStrategy>;
};

export type AuthenticationConfirmationTokenOptions = Optional<
  AuthenticationConfirmationTokenAttributes,
  EntityKeys
>;

const schema = Joi.object<AuthenticationConfirmationTokenAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    clientId: Joi.string().guid().required(),
    confirmedIdentifiers: Joi.array().items(Joi.string()).required(),
    country: Joi.string().allow(null).required(),
    expires: Joi.date().required(),
    factors: Joi.array().items(Joi.string().lowercase()).required(),
    identityId: Joi.string().guid().required(),
    levelOfAssurance: JOI_LEVEL_OF_ASSURANCE,
    maximumLevelOfAssurance: JOI_LEVEL_OF_ASSURANCE,
    metadata: Joi.object().required(),
    methods: Joi.array().items(Joi.string().lowercase()).required(),
    nonce: Joi.string().required(),
    remember: Joi.boolean().required(),
    sessionId: Joi.string().guid().required(),
    signature: Joi.string().length(128).required(),
    singleSignOn: Joi.boolean().required(),
    strategies: Joi.array().items(Joi.string().lowercase()).required(),
  })
  .required();

export class AuthenticationConfirmationToken extends LindormEntity<AuthenticationConfirmationTokenAttributes> {
  public readonly clientId: string;
  public readonly confirmedIdentifiers: Array<string>;
  public readonly country: string | null;
  public readonly expires: Date;
  public readonly factors: Array<AuthenticationFactor>;
  public readonly identityId: string;
  public readonly levelOfAssurance: LevelOfAssurance;
  public readonly maximumLevelOfAssurance: LevelOfAssurance;
  public readonly metadata: Dict;
  public readonly methods: Array<AuthenticationMethod>;
  public readonly nonce: string;
  public readonly remember: boolean;
  public readonly sessionId: string;
  public readonly signature: string;
  public readonly singleSignOn: boolean;
  public readonly strategies: Array<AuthenticationStrategy>;

  public constructor(options: AuthenticationConfirmationTokenOptions) {
    super(options);

    this.clientId = options.clientId;
    this.confirmedIdentifiers = options.confirmedIdentifiers;
    this.country = options.country;
    this.expires = options.expires;
    this.factors = options.factors;
    this.identityId = options.identityId;
    this.levelOfAssurance = options.levelOfAssurance;
    this.maximumLevelOfAssurance = options.maximumLevelOfAssurance;
    this.metadata = options.metadata;
    this.methods = options.methods;
    this.nonce = options.nonce;
    this.remember = options.remember;
    this.sessionId = options.sessionId;
    this.signature = options.signature;
    this.singleSignOn = options.singleSignOn;
    this.strategies = options.strategies;
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): AuthenticationConfirmationTokenAttributes {
    return {
      ...this.defaultJSON(),

      clientId: this.clientId,
      confirmedIdentifiers: this.confirmedIdentifiers,
      country: this.country,
      expires: this.expires,
      factors: this.factors,
      identityId: this.identityId,
      levelOfAssurance: this.levelOfAssurance,
      maximumLevelOfAssurance: this.maximumLevelOfAssurance,
      metadata: this.metadata,
      methods: this.methods,
      nonce: this.nonce,
      remember: this.remember,
      sessionId: this.sessionId,
      signature: this.signature,
      singleSignOn: this.singleSignOn,
      strategies: this.strategies,
    };
  }
}
