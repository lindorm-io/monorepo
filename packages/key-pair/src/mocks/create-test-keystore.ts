import { Keystore, KeystoreOptions } from "../class";
import { createTestKeyPair } from "./create-test-key-pair";

export const createTestKeystore = (options: Partial<KeystoreOptions> = {}): Keystore =>
  new Keystore({
    keys: [createTestKeyPair()],
    ...options,
  });
