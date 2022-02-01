import { Email, EmailOptions } from "../../entity";
import { getRandomString } from "@lindorm-io/core";
import { randomUUID } from "crypto";

export const getTestEmail = (options: Partial<EmailOptions> = {}): Email =>
  new Email({
    identityId: randomUUID(),
    email: `${getRandomString(16)}@lindorm.io`,
    primary: true,
    verified: true,
    ...options,
  });
