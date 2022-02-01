import Joi from "joi";
import { JOI_GUID } from "../common";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export interface MfaCookieSessionAttributes extends EntityAttributes {
  identityId: string;
}

export type MfaCookieSessionOptions = Optional<MfaCookieSessionAttributes, EntityKeys>;

const schema = Joi.object<MfaCookieSessionAttributes>({
  ...JOI_ENTITY_BASE,

  identityId: JOI_GUID.required(),
});

export class MfaCookieSession
  extends LindormEntity<MfaCookieSessionAttributes>
  implements MfaCookieSessionAttributes
{
  public readonly identityId: string;

  public constructor(options: MfaCookieSessionOptions) {
    super(options);

    this.identityId = options.identityId;
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
    };
  }
}
