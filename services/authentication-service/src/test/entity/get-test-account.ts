import { Account, AccountOptions } from "../../entity";
import { baseHash } from "@lindorm-io/core";

export const getTestAccount = (options: Partial<AccountOptions> = {}): Account =>
  new Account({
    browserLinkCode: "BROWSER-LINK-CODE",
    password: baseHash("password"),
    recoveryCode: baseHash("recoveryCode"),
    salt: {
      aes: "84s8VNdOtIvwL6KvNd28YktehfPhwGy0xObf7c7yr6Vz3XwH3CA9aOi7rSYKhPICaTukA0qqSzVhm1WW1L48YvpYD9OLAaNFqSAy6VIdA3NF096aBoawvt2boQkHF5tC",
      sha: "84s8VNdOtIvwL6KvNd28YktehfPhwGy0xObf7c7yr6Vz3XwH3CA9aOi7rSYKhPICaTukA0qqSzVhm1WW1L48YvpYD9OLAaNFqSAy6VIdA3NF096aBoawvt2boQkHF5tC",
    },
    totp: baseHash("totp"),
    ...options,
  });
