import Joi from "joi";
import { JOI_GUID, JOI_LEVEL_OF_ASSURANCE, LevelOfAssurance } from "../common";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";
import { JOI_AUTHENTICATION_METHOD } from "../constant";
import { AuthenticationMethod } from "../enum";

export interface MfaCookieSessionAttributes extends EntityAttributes {
  identityId: string;
  levelOfAssurance: LevelOfAssurance;
  methods: Array<AuthenticationMethod>;
}

export type MfaCookieSessionOptions = Optional<MfaCookieSessionAttributes, EntityKeys>;

const schema = Joi.object<MfaCookieSessionAttributes>()
  .keys({
    ...JOI_ENTITY_BASE,

    identityId: JOI_GUID.required(),
    levelOfAssurance: JOI_LEVEL_OF_ASSURANCE.required(),
    methods: Joi.array().items(JOI_AUTHENTICATION_METHOD).required(),
  })
  .required();

export class MfaCookieSession
  extends LindormEntity<MfaCookieSessionAttributes>
  implements MfaCookieSessionAttributes
{
  public readonly identityId: string;
  public readonly levelOfAssurance: LevelOfAssurance;
  public readonly methods: Array<AuthenticationMethod>;

  public constructor(options: MfaCookieSessionOptions) {
    super(options);

    this.identityId = options.identityId;
    this.levelOfAssurance = options.levelOfAssurance;
    this.methods = options.methods;
  }

  public create(): void {
    /* intentionally left empty */
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): MfaCookieSessionAttributes {
    return {
      ...this.defaultJSON(),

      identityId: this.identityId,
      levelOfAssurance: this.levelOfAssurance,
      methods: this.methods,
    };
  }
}
