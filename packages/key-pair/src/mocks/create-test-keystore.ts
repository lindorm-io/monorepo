import { Keystore, KeystoreOptions } from "../class";
import {
  createTestKeyPairEC,
  createTestKeyPairHS,
  createTestKeyPairRSA,
} from "./create-test-key-pair";

export const createTestKeystore = (options: Partial<KeystoreOptions> = {}): Keystore =>
  new Keystore({
    keys: [createTestKeyPairEC(), createTestKeyPairHS(), createTestKeyPairRSA()],
    ...options,
  });
