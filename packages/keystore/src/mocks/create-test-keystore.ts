import { Logger, createMockLogger } from "@lindorm-io/core-logger";
import { WebKeySet } from "@lindorm-io/jwk";
import { Keystore } from "../classes";
import { StoredKeySet } from "../entities";
import { createTestStoredKeySetEc, createTestStoredKeySetRsa } from "./create-test-key-set";

export const createTestKeystore = (
  keys: Array<StoredKeySet | WebKeySet> = [],
  logger: Logger = createMockLogger(),
): Keystore =>
  new Keystore(
    keys.length ? keys : [createTestStoredKeySetEc(), createTestStoredKeySetRsa({ use: "enc" })],
    logger,
  );
