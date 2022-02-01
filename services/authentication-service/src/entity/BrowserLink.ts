import Joi from "joi";
import { JOI_GUID } from "../common";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export interface BrowserLinkAttributes extends EntityAttributes {
  identityId: string;
}

export type BrowserLinkOptions = Optional<BrowserLinkAttributes, EntityKeys>;

const schema = Joi.object<BrowserLinkAttributes>({
  ...JOI_ENTITY_BASE,

  identityId: JOI_GUID.required(),
});

export class BrowserLink
  extends LindormEntity<BrowserLinkAttributes>
  implements BrowserLinkAttributes
{
  public readonly identityId: string;

  public constructor(options: BrowserLinkOptions) {
    super(options);

    this.identityId = options.identityId;
  }

  public create(): void {
    /* intentionally left empty */
  }

  public async schemaValidation(): Promise<void> {
    await schema.validateAsync(this.toJSON());
  }

  public toJSON(): BrowserLinkAttributes {
    return {
      ...this.defaultJSON(),

      identityId: this.identityId,
    };
  }
}
