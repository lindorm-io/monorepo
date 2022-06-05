import { Account, AccountOptions } from "../../entity";
import { baseHash } from "@lindorm-io/core";

export const createTestAccount = (options: Partial<AccountOptions> = {}): Account =>
  new Account({
    browserLinkCode: "BROWSER-LINK-CODE",
    password: baseHash("password"),
    recoveryCode: baseHash("recoveryCode"),
    totp: baseHash("totp"),
    ...options,
  });
