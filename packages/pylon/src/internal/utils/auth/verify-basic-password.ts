import { isString } from "@lindorm/is";
import { randomString } from "@lindorm/random";
import { ShaKit } from "@lindorm/sha";

const sha = new ShaKit();

/**
 * Stands in for the configured password when the username is unknown, so that path performs the
 * same hashing and comparison work as a wrong password. Random per process; the result of the
 * comparison against it is always discarded, so its value carries nothing.
 */
const DUMMY_PASSWORD = randomString(32);

/**
 * Compares a supplied password with the configured one in constant time.
 *
 * Plaintext secrets must never be compared with `!==` — it short-circuits on the first differing
 * character and leaks the password character by character through timing. A `timingSafeEqual` over
 * the raw UTF-8 bytes is no answer either: it throws on unequal-length buffers, and the length
 * guard it forces leaks the password length.
 *
 * Comparing fixed-length SHA-256 digests solves both — equal-length by construction, no leak.
 * `ShaKit.verify` does the `timingSafeEqual` over the decoded digest bytes.
 *
 * `expected` is `undefined` when no credential matches the username. The digest work still runs
 * (against the dummy) so that an unknown username and a wrong password cost the same and valid
 * usernames cannot be enumerated by timing.
 */
export const verifyBasicPassword = (
  password: string,
  expected: string | undefined,
): boolean => {
  const match = sha.verify(password, sha.hash(expected ?? DUMMY_PASSWORD));

  return isString(expected) && match;
};
