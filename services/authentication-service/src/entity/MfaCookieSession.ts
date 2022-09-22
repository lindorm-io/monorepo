import Joi from "joi";
import { JOI_AUTHENTICATION_METHOD } from "../constant";
import { AuthenticationMethod, JOI_GUID, JOI_LEVEL_OF_ASSURANCE } from "../common";
import { LevelOfAssurance } from "@lindorm-io/jwt";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export interface MfaCookieSessionAttributes extends EntityAttributes {
  expires: Date;
  identityId: string;
  levelOfAssurance: LevelOfAssurance;
  methods: Array<AuthenticationMethod>;
}

export type MfaCookieSessionOptions = Optional<MfaCookieSessionAttributes, EntityKeys>;

const schema = Joi.object<MfaCookieSessionAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    expires: Joi.date().required(),
    identityId: JOI_GUID.required(),
    levelOfAssurance: JOI_LEVEL_OF_ASSURANCE.required(),
    methods: Joi.array().items(JOI_AUTHENTICATION_METHOD).required(),
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

  public constructor(options: MfaCookieSessionOptions) {
    super(options);

    this.expires = options.expires;
    this.identityId = options.identityId;
    this.levelOfAssurance = options.levelOfAssurance;
    this.methods = options.methods;
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
    };
  }
}
