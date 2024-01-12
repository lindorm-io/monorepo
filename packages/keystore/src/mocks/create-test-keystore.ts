import { Logger, createMockLogger } from "@lindorm-io/core-logger";
import { Keystore } from "../classes";
import { StoredKeySet } from "../entities";
import { createTestStoredKeySetEc, createTestStoredKeySetRsa } from "./create-test-key-set";

export const createTestKeystore = (
  keys: Array<StoredKeySet> = [],
  logger: Logger = createMockLogger(),
): Keystore =>
  new Keystore(
    keys.length ? keys : [createTestStoredKeySetEc(), createTestStoredKeySetRsa({ use: "enc" })],
    logger,
  );
