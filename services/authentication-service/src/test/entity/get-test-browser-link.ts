import { BrowserLink, BrowserLinkOptions } from "../../entity";

export const getTestBrowserLink = (options: Partial<BrowserLinkOptions> = {}): BrowserLink =>
  new BrowserLink({
    identityId: "72cfccb7-de1c-4f41-9bd0-d53c235578f9",
    ...options,
  });
