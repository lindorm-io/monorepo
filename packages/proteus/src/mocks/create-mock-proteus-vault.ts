import { Amphora, type IAmphora } from "@lindorm/amphora";
import { KryptosKit } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { ProteusEncryptionKey } from "../types/encryption.js";

/**
 * Purpose carried by the KEK the mocks mint, and the only thing the default
 * `encryption` selector matches on. Named rather than inlined so the two stay
 * in step, and so a stray test ciphertext is greppable back to here.
 */
export const MOCK_KEK_PURPOSE = "proteus:mock:kek";

const MOCK_KEK_ISSUER = "https://mock.proteus.lindorm.io/";

export type MockProteusVault = {
  amphora: IAmphora;
  encryption: ProteusEncryptionKey;
};

/**
 * The at-rest encryption default for the memory-backed mocks: a REAL `Amphora`
 * holding one freshly minted AES KEK, plus the source-level `encryption`
 * selector that names it.
 *
 * Nothing here is stubbed — `@Encrypted` columns are sealed with a real key and
 * opened again on read, exactly as on a live source. Only the key's PROVENANCE
 * is test-local, and no test asserts on that. The alternative — no amphora by
 * default — makes every consumer with one encrypted column hand-roll a vault
 * before it can test something unrelated, and buys no fidelity: an app that
 * forgot to wire its amphora already fails loudly at its own `source.setup()`.
 */
export const createMockProteusVault = (logger: ILogger): MockProteusVault => {
  const amphora = new Amphora({ logger });

  amphora.add(
    KryptosKit.generate.enc.oct({
      algorithm: "A256KW",
      issuer: MOCK_KEK_ISSUER,
      purpose: MOCK_KEK_PURPOSE,
    }),
  );

  return { amphora, encryption: { condition: { purpose: MOCK_KEK_PURPOSE } } };
};
