import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";
import Joi from "joi";

export interface BrowserLinkAttributes extends EntityAttributes {
  accountId: string;
  browser: string;
  os: string;
  platform: string;
}

export type BrowserLinkOptions = Optional<BrowserLinkAttributes, EntityKeys>;

const schema = Joi.object<BrowserLinkAttributes>({
  ...JOI_ENTITY_BASE,

  accountId: Joi.string().guid().required(),
  browser: Joi.string().required(),
  os: Joi.string().required(),
  platform: Joi.string().required(),
});

export class BrowserLink
  extends LindormEntity<BrowserLinkAttributes>
  implements BrowserLinkAttributes
{
  public readonly accountId: string;
  public readonly browser: string;
  public readonly os: string;
  public readonly platform: string;

  public constructor(options: BrowserLinkOptions) {
    super(options);

    this.accountId = options.accountId;
    this.browser = options.browser;
    this.os = options.os;
    this.platform = options.platform;
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

      accountId: this.accountId,
      browser: this.browser,
      os: this.os,
      platform: this.platform,
    };
  }
}
