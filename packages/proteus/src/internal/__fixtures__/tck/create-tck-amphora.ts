import type { IAmphora } from "@lindorm/amphora";
import { Amphora } from "@lindorm/amphora";
import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { ProteusEncryptionKey } from "../../../types/encryption.js";

const ISSUER = "https://test.proteus.tck/";

/**
 * The KEK every `@Encrypted()` field in the TCK entities must be sealed with:
 * the `purpose: "proteus:tck"` key the source-level `TCK_ENCRYPTION` default
 * names. Created FIRST, so it is the OLDER of the two vault keys.
 */
export const TCK_INTENDED_KEK = KryptosKit.generate.enc.oct({
  algorithm: "A128KW",
  createdAt: new Date("2024-01-01T01:00:00.000Z"),
  issuer: ISSUER,
  purpose: "proteus:tck",
});

/**
 * THE TRAP — an enc-capable-but-WRONG KEK. A real `dir` / `A256GCM` key with a
 * private half, so it seals AND unseals a value exactly like the intended one.
 * It is NEWER (amphora sorts newest-first) and differs only by `purpose`. With a
 * single-key vault a six-driver TCK could never detect wrong-key selection —
 * there was no wrong key TO select. Now, if selection ever stops scoping by the
 * entity's predicate, this newer key wins, every round-trip STILL passes (it
 * decrypts its own ciphertext), and only an assertion on the selected KEK's id
 * catches it. The encryption suite makes that assertion.
 */
export const TCK_TRAP_KEK = KryptosKit.generate.enc.oct({
  algorithm: "dir",
  createdAt: new Date("2024-01-01T03:00:00.000Z"),
  encryption: "A256GCM",
  issuer: ISSUER,
  purpose: "proteus:tck:rotated",
});

/**
 * Every `@Encrypted()` field in the TCK entities is bare, so the source-level
 * default is what names their key — the ergonomic path, exercised against all
 * six drivers.
 */
export const TCK_ENCRYPTION: ProteusEncryptionKey = {
  predicate: { purpose: "proteus:tck" },
};

export const createTckAmphora = (): IAmphora => {
  const amphora = new Amphora({ logger: createMockLogger() });
  amphora.add([TCK_INTENDED_KEK, TCK_TRAP_KEK]);
  return amphora;
};
