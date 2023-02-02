import { Identifier, IdentifierOptions } from "../../entity";
import { IdentifierType } from "../../common";
import { configuration } from "../../server/configuration";
import { randomNumber, randomString } from "@lindorm-io/random";
import { randomUUID } from "crypto";

export const createTestEmailIdentifier = (options: Partial<IdentifierOptions> = {}): Identifier =>
  new Identifier({
    identifier: `${randomString(16).toLowerCase()}@lindorm.io`,
    identityId: randomUUID(),
    label: "home",
    primary: true,
    provider: configuration.server.domain,
    type: IdentifierType.EMAIL,
    verified: true,
    ...options,
  });

export const createTestExternalIdentifier = (
  options: Partial<IdentifierOptions> = {},
): Identifier =>
  new Identifier({
    identifier: randomString(32),
    identityId: randomUUID(),
    label: "home",
    primary: false,
    provider: "https://login.apple.com/",
    type: IdentifierType.EXTERNAL,
    verified: false,
    ...options,
  });

export const createTestPhoneIdentifier = (options: Partial<IdentifierOptions> = {}): Identifier =>
  new Identifier({
    identifier: `+4670${randomNumber(7)}`,
    identityId: randomUUID(),
    label: "home",
    primary: true,
    provider: configuration.server.domain,
    type: IdentifierType.PHONE,
    verified: true,
    ...options,
  });
