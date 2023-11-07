import {
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

export type MfaCookieSessionAttributes = EntityAttributes & {
  expires: Date;
  identityId: string;
  levelOfAssurance: LevelOfAssurance;
  methods: Array<AuthenticationMethod>;
  strategies: Array<AuthenticationStrategy>;
};

export type MfaCookieSessionOptions = Optional<MfaCookieSessionAttributes, EntityKeys>;

const schema = Joi.object<MfaCookieSessionAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    expires: Joi.date().required(),
    identityId: Joi.string().guid().required(),
    levelOfAssurance: JOI_LEVEL_OF_ASSURANCE.required(),
    methods: Joi.array().items(Joi.string().lowercase()).required(),
    strategies: Joi.array().items(Joi.string().lowercase()).required(),
  })
  .required();

export class MfaCookieSession
  extends LindormEntity<MfaCookieSessionAttributes>
  implements MfaCookieSessionAttributes
{
  public readonly expires: Date;
  public readonly identityId: string;
  public readonly levelOfAssurance: LevelOfAssurance;
  public readonly methods: Array<AuthenticationMethod>;
  public readonly strategies: Array<AuthenticationStrategy>;

  public constructor(options: MfaCookieSessionOptions) {
    super(options);

    this.expires = options.expires;
    this.identityId = options.identityId;
    this.levelOfAssurance = options.levelOfAssurance;
    this.methods = options.methods;
    this.strategies = options.strategies;
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): MfaCookieSessionAttributes {
    return {
      ...this.defaultJSON(),

      expires: this.expires,
      identityId: this.identityId,
      levelOfAssurance: this.levelOfAssurance,
      methods: this.methods,
      strategies: this.strategies,
    };
  }
}
