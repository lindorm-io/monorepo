import type { IAmphora } from "@lindorm/amphora";
import { Amphora } from "@lindorm/amphora";
import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { ProteusEncryptionKey } from "../../../types/encryption.js";

/**
 * Every `@Encrypted()` field in the TCK entities is bare, so the source-level
 * default is what names their key — the ergonomic path, exercised against all
 * six drivers.
 */
export const TCK_ENCRYPTION: ProteusEncryptionKey = {
  predicate: { purpose: "proteus:tck" },
};

export const createTckAmphora = (): IAmphora => {
  const key = KryptosKit.generate.enc.oct({
    algorithm: "A128KW",
    issuer: "https://test.proteus.tck/",
    purpose: "proteus:tck",
  });
  const amphora = new Amphora({ logger: createMockLogger() });
  amphora.add(key);
  return amphora;
};
