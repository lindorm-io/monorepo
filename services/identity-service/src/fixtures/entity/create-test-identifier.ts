import { IdentifierType } from "@lindorm-io/common-enums";
import { randomNumber, randomString } from "@lindorm-io/random";
import { randomUUID } from "crypto";
import { Identifier, IdentifierOptions } from "../../entity";
import { configuration } from "../../server/configuration";

export const createTestEmailIdentifier = (options: Partial<IdentifierOptions> = {}): Identifier =>
  new Identifier({
    identityId: randomUUID(),
    label: "home",
    primary: true,
    provider: configuration.server.domain,
    type: IdentifierType.EMAIL,
    value: `${randomString(16).toLowerCase()}@lindorm.io`,
    verified: true,
    ...options,
  });

export const createTestExternalIdentifier = (
  options: Partial<IdentifierOptions> = {},
): Identifier =>
  new Identifier({
    identityId: randomUUID(),
    label: "home",
    primary: true,
    provider: "https://login.apple.com/",
    type: IdentifierType.EXTERNAL,
    value: randomString(32),
    verified: true,
    ...options,
  });

export const createTestPhoneIdentifier = (options: Partial<IdentifierOptions> = {}): Identifier =>
  new Identifier({
    identityId: randomUUID(),
    label: "home",
    primary: true,
    provider: configuration.server.domain,
    type: IdentifierType.PHONE,
    value: `+4670${randomNumber(7)}`,
    verified: true,
    ...options,
  });

export const createTestNinIdentifier = (options: Partial<IdentifierOptions> = {}): Identifier =>
  new Identifier({
    identityId: randomUUID(),
    label: "home",
    primary: true,
    provider: configuration.server.domain,
    type: IdentifierType.NIN,
    value: randomNumber(10).toString().padEnd(10, "0"),
    verified: true,
    ...options,
  });

export const createTestSsnIdentifier = (options: Partial<IdentifierOptions> = {}): Identifier =>
  new Identifier({
    identityId: randomUUID(),
    label: "home",
    primary: true,
    provider: configuration.server.domain,
    type: IdentifierType.SSN,
    value: randomNumber(12).toString().padEnd(12, "0"),
    verified: true,
    ...options,
  });
