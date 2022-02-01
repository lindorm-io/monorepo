import Joi from "joi";
import { JOI_GUID } from "../common";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export interface ExternalIdentifierAttributes extends EntityAttributes {
  identifier: string;
  identityId: string;
  provider: string;
}

export type ExternalIdentifierOptions = Optional<ExternalIdentifierAttributes, EntityKeys>;

const schema = Joi.object<ExternalIdentifierAttributes>({
  ...JOI_ENTITY_BASE,

  identifier: Joi.string().required(),
  identityId: JOI_GUID.required(),
  provider: Joi.string().uri().required(),
});

export class ExternalIdentifier extends LindormEntity<ExternalIdentifierAttributes> {
  public readonly identifier: string;
  public readonly identityId: string;
  public readonly provider: string;

  public constructor(options: ExternalIdentifierOptions) {
    super(options);

    this.identifier = options.identifier;
    this.identityId = options.identityId;
    this.provider = options.provider;
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): ExternalIdentifierAttributes {
    return {
      ...this.defaultJSON(),

      identifier: this.identifier,
      identityId: this.identityId,
      provider: this.provider,
    };
  }
}
