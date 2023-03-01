import Joi from "joi";
import { AuthenticationMethod, LevelOfAssurance } from "@lindorm-io/common-types";
import { JOI_LEVEL_OF_ASSURANCE } from "../common";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export type BrowserSessionAttributes = EntityAttributes & {
  identityId: string;
  latestAuthentication: Date;
  levelOfAssurance: LevelOfAssurance;
  metadata: Record<string, any>;
  methods: Array<AuthenticationMethod>;
  remember: boolean;
  sso: boolean;
};

export type BrowserSessionOptions = Optional<BrowserSessionAttributes, EntityKeys>;

const schema = Joi.object<BrowserSessionAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    identityId: Joi.string().guid().required(),
    latestAuthentication: Joi.date().required(),
    levelOfAssurance: JOI_LEVEL_OF_ASSURANCE.required(),
    metadata: Joi.object().required(),
    methods: Joi.array().items(Joi.string().lowercase()).required(),
    remember: Joi.boolean().required(),
    sso: Joi.boolean().required(),
  })
  .required();

export class BrowserSession extends LindormEntity<BrowserSessionAttributes> {
  public readonly identityId: string;
  public readonly metadata: Record<string, any>;

  public latestAuthentication: Date;
  public levelOfAssurance: LevelOfAssurance;
  public methods: Array<AuthenticationMethod>;
  public remember: boolean;
  public sso: boolean;

  public constructor(options: BrowserSessionOptions) {
    super(options);

    this.identityId = options.identityId;
    this.latestAuthentication = options.latestAuthentication;
    this.levelOfAssurance = options.levelOfAssurance;
    this.metadata = options.metadata || {};
    this.methods = options.methods;
    this.remember = options.remember === true;
    this.sso = options.sso === true;
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): BrowserSessionAttributes {
    return {
      ...this.defaultJSON(),

      identityId: this.identityId,
      latestAuthentication: this.latestAuthentication,
      levelOfAssurance: this.levelOfAssurance,
      metadata: this.metadata,
      methods: this.methods,
      remember: this.remember,
      sso: this.sso,
    };
  }
}
