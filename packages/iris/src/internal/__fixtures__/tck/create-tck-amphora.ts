import { Amphora, type IAmphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { TEST_KEY_ENC_AUDIT, TEST_KEY_ENC_MESSAGE } from "../keys.js";

/**
 * The KEK the encryption suite expects every driver to seal with: the
 * `purpose: "message"` key the `@Encrypted({ condition: { purpose: "message" } })`
 * message names.
 */
export const TCK_INTENDED_KEK = TEST_KEY_ENC_MESSAGE;

/**
 * THE TRAP — an enc-capable-but-WRONG KEK. It is a real `dir` / `A256GCM`
 * encryption key with a private half (so it can both seal AND unseal, exactly
 * like the intended one), it is NEWER than the intended KEK, and it differs only
 * by `purpose` (`audit`, not `message`). That is what makes it dangerous: if key
 * selection ever stops scoping by the message's condition, this newer key wins,
 * the round-trip STILL goes green (a wrong-but-valid KEK seals and opens the
 * payload just fine), and only an assertion on the SEALED `kid` catches it. The
 * encryption suite makes that assertion.
 */
export const TCK_TRAP_KEK = TEST_KEY_ENC_AUDIT;

/**
 * A REAL vault for the TCK — the encryption suite is worthless without one. A
 * `find: vi.fn()` always hands back the key it was told to, so it cannot select
 * the wrong one, and a mocked `AesKit` cannot fail to unwrap what it wrapped.
 *
 * It holds the trap key deliberately (see `TCK_TRAP_KEK`): a newer, enc-capable
 * key under a different purpose that a mis-scoped lookup would reach for. The
 * encryption suite proves selection picks the intended KEK, not the trap.
 */
export const createTckAmphora = async (): Promise<IAmphora> => {
  const amphora = new Amphora({
    domain: "https://test.lindorm.io/",
    logger: createMockLogger(),
  });

  await amphora.setup();

  amphora.add([TCK_INTENDED_KEK, TCK_TRAP_KEK]);

  return amphora;
};
