import { Amphora, type IAmphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { TEST_KEY_ENC_MESSAGE, TEST_KEY_SIG_MESSAGE } from "../keys.js";

/**
 * A REAL vault for the TCK — the encryption suite is worthless without one. A
 * `find: vi.fn()` always hands back the key it was told to, so it cannot select
 * the wrong one, and a mocked `AesKit` cannot fail to unwrap what it wrapped.
 *
 * It holds the signing key too, and deliberately: it is NEWER than the message
 * KEK and answers the same `purpose`, so an unfloored lookup reaches for it
 * first. Every driver's encryption suite now proves it does not.
 */
export const createTckAmphora = async (): Promise<IAmphora> => {
  const amphora = new Amphora({
    domain: "https://test.lindorm.io/",
    logger: createMockLogger(),
  });

  await amphora.setup();

  amphora.add([TEST_KEY_ENC_MESSAGE, TEST_KEY_SIG_MESSAGE]);

  return amphora;
};
