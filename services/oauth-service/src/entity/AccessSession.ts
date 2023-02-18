import Joi from "joi";
import { AuthenticationMethod, LevelOfAssurance } from "@lindorm-io/common-types";
import { JOI_LEVEL_OF_ASSURANCE, JOI_NONCE } from "../common";
import { randomString } from "@lindorm-io/random";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export type AccessSessionAttributes = EntityAttributes & {
  audiences: Array<string>;
  browserSessionId: string;
  clientId: string;
  identityId: string;
  latestAuthentication: Date;
  levelOfAssurance: LevelOfAssurance;
  methods: Array<AuthenticationMethod>;
  nonce: string;
  scopes: Array<string>;
};

export type AccessSessionOptions = Optional<
  AccessSessionAttributes,
  EntityKeys | "audiences" | "latestAuthentication" | "nonce" | "scopes"
>;

const schema = Joi.object<AccessSessionAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    audiences: Joi.array().items(Joi.string().guid()).required(),
    browserSessionId: Joi.string().guid().required(),
    clientId: Joi.string().guid().required(),
    identityId: Joi.string().guid().required(),
    latestAuthentication: Joi.date().required(),
    levelOfAssurance: JOI_LEVEL_OF_ASSURANCE.required(),
    methods: Joi.array().items(Joi.string().lowercase()).required(),
    nonce: JOI_NONCE.required(),
    scopes: Joi.array().items(Joi.string().lowercase()).required(),
  })
  .required();

export class AccessSession extends LindormEntity<AccessSessionAttributes> {
  public readonly browserSessionId: string;
  public readonly clientId: string;
  public readonly identityId: string;

  public audiences: Array<string>;
  public latestAuthentication: Date;
  public levelOfAssurance: LevelOfAssurance;
  public methods: Array<AuthenticationMethod>;
  public nonce: string;
  public scopes: Array<string>;

  public constructor(options: AccessSessionOptions) {
    super(options);

    this.audiences = options.audiences || [];
    this.browserSessionId = options.browserSessionId;
    this.clientId = options.clientId;
    this.identityId = options.identityId;
    this.latestAuthentication = options.latestAuthentication || new Date();
    this.levelOfAssurance = options.levelOfAssurance;
    this.methods = options.methods;
    this.nonce = options.nonce || randomString(16);
    this.scopes = options.scopes || [];
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): AccessSessionAttributes {
    return {
      ...this.defaultJSON(),

      audiences: this.audiences,
      browserSessionId: this.browserSessionId,
      clientId: this.clientId,
      identityId: this.identityId,
      latestAuthentication: this.latestAuthentication,
      levelOfAssurance: this.levelOfAssurance,
      methods: this.methods,
      nonce: this.nonce,
      scopes: this.scopes,
    };
  }
}
