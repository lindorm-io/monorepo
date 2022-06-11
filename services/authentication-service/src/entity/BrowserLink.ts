import Joi from "joi";
import { Environment } from "@lindorm-io/koa";
import { JOI_GUID } from "../common";
import {
  EntityAttributes,
  EntityKeys,
  JOI_ENTITY_BASE,
  LindormEntity,
  Optional,
} from "@lindorm-io/entity";

export interface BrowserLinkAttributes extends EntityAttributes {
  accountId: string;
  browser: string;
  environment: Environment;
  os: string;
  platform: string;
}

export type BrowserLinkOptions = Optional<BrowserLinkAttributes, EntityKeys>;

const schema = Joi.object<BrowserLinkAttributes>({
  ...JOI_ENTITY_BASE,

  accountId: JOI_GUID.required(),
  browser: Joi.string().required(),
  environment: Joi.string().required(),
  os: Joi.string().required(),
  platform: Joi.string().required(),
});

export class BrowserLink
  extends LindormEntity<BrowserLinkAttributes>
  implements BrowserLinkAttributes
{
  public readonly accountId: string;
  public readonly browser: string;
  public readonly environment: Environment;
  public readonly os: string;
  public readonly platform: string;

  public constructor(options: BrowserLinkOptions) {
    super(options);

    this.accountId = options.accountId;
    this.browser = options.browser;
    this.environment = options.environment;
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
      environment: this.environment,
      os: this.os,
      platform: this.platform,
    };
  }
}
