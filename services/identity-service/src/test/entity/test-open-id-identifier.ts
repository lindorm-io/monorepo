import { ExternalIdentifier, ExternalIdentifierOptions } from "../../entity";
import { randomUUID } from "crypto";
import { getRandomString } from "@lindorm-io/core";

export const getTestExternalIdentifier = (
  options: Partial<ExternalIdentifierOptions> = {},
): ExternalIdentifier =>
  new ExternalIdentifier({
    identityId: randomUUID(),
    identifier: getRandomString(32),
    provider: "https://login.apple.com/",
    ...options,
  });
