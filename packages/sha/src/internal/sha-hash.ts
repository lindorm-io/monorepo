import { createHash, timingSafeEqual } from "crypto";
import { ShaError } from "../errors/index.js";
import type { CreateShaHashOptions, VerifyShaHashOptions } from "../types/index.js";

const createShaDigest = ({
  algorithm = "SHA256",
  data,
}: Omit<CreateShaHashOptions, "encoding">): Buffer =>
  createHash(algorithm).update(data).digest();

export const createShaHash = ({
  encoding = "base64",
  ...options
}: CreateShaHashOptions): string => createShaDigest(options).toString(encoding);

// Compares the decoded digest BYTES in constant time. Encoded strings must never be
// compared with `===` - it short-circuits on the first differing character and leaks
// the digest byte by byte through timing (client secrets are verified this way).
//
// Both lengths are guarded first: `timingSafeEqual` throws on unequal-length buffers, and
// a malformed, truncated, empty or garbage `hash` must simply be `false`. The string guard
// is not redundant - `Buffer.from` is lenient (it stops at base64 padding, drops invalid
// characters), so without it a canonical hash with trailing junk would decode to a match.
// Lengths carry no secret, so comparing them is not a timing leak.
export const verifyShaHash = ({
  encoding = "base64",
  hash,
  ...options
}: VerifyShaHashOptions): boolean => {
  const digest = createShaDigest(options);
  const expected = Buffer.from(hash, encoding);

  if (hash.length !== digest.toString(encoding).length) return false;
  if (expected.length !== digest.length) return false;

  return timingSafeEqual(digest, expected);
};

export const assertShaHash = (options: VerifyShaHashOptions): void => {
  if (verifyShaHash(options)) return;
  throw new ShaError("Hash does not match", {
    code: "hash_mismatch",
    title: "Hash Mismatch",
    details:
      "The computed SHA hash of the provided data does not match the expected hash.",
  });
};
