import { BrowserLink, BrowserLinkOptions } from "../../entity";

export const createTestBrowserLink = (options: Partial<BrowserLinkOptions> = {}): BrowserLink =>
  new BrowserLink({
    accountId: "72cfccb7-de1c-4f41-9bd0-d53c235578f9",
    browser: "browser",
    os: "os",
    platform: "platform",
    ...options,
  });
