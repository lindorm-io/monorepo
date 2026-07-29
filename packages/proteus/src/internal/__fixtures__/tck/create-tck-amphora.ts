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
 * entity's condition, this newer key wins, every round-trip STILL passes (it
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
 * THE STAGED KEK — a third enc-capable key, distinct from BOTH the intended KEK
 * and the trap, reachable only via its own `purpose`. It exists so the staging
 * suite can prove `source.stageFieldDecorator(...)` OVERRIDES the source-level
 * default per field: a field staged to this condition must seal with THIS key's
 * id, while its unstaged siblings keep sealing with the intended KEK. Created
 * between the intended (oldest) and trap (newest) keys — its selection is by
 * `purpose`, not recency, so the ordering is immaterial; it is fixed only for
 * determinism. `publish: false`, like every internal at-rest KEK.
 */
export const TCK_STAGED_KEK = KryptosKit.generate.enc.oct({
  algorithm: "A128KW",
  createdAt: new Date("2024-01-01T02:00:00.000Z"),
  issuer: ISSUER,
  publish: false,
  purpose: "proteus:tck:staged",
});

/**
 * Every `@Encrypted()` field in the TCK entities is bare, so the source-level
 * default is what names their key — the ergonomic path, exercised against all
 * six drivers.
 */
export const TCK_ENCRYPTION: ProteusEncryptionKey = {
  condition: { purpose: "proteus:tck" },
};

/**
 * The selector the driver harnesses stage onto one field of `TckStagedEncrypted`
 * (via `source.stageFieldDecorator`) before `setup()`. Names the STAGED KEK, so
 * a staged field seals with `TCK_STAGED_KEK`, not the source default.
 */
export const TCK_STAGED_CONDITION = { purpose: "proteus:tck:staged" } as const;

export const createTckAmphora = (): IAmphora => {
  const amphora = new Amphora({ logger: createMockLogger() });
  amphora.add([TCK_INTENDED_KEK, TCK_TRAP_KEK, TCK_STAGED_KEK]);
  return amphora;
};
