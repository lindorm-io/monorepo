import { type IKryptos, KryptosKit } from "@lindorm/kryptos";

const defaults = {
  issuer: "https://test.lindorm.io/",
  notBefore: new Date("2024-01-01T00:00:00.000Z"),
};

/**
 * The message KEK a deployment mints: an encryption key with a private half,
 * unpublished (it never leaves the service) and scoped by purpose.
 */
export const TEST_KEY_ENC_MESSAGE = KryptosKit.generate.enc.oct({
  ...defaults,
  algorithm: "dir",
  createdAt: new Date("2024-01-01T01:00:00.000Z"),
  encryption: "A256GCM",
  publish: false,
  purpose: "message",
});

/** A second, NEWER message KEK under a different purpose. */
export const TEST_KEY_ENC_AUDIT = KryptosKit.generate.enc.oct({
  ...defaults,
  algorithm: "dir",
  createdAt: new Date("2024-01-01T03:00:00.000Z"),
  encryption: "A256GCM",
  publish: false,
  purpose: "audit",
});

/**
 * THE TRAP. A SIGNING key that is newer than every encryption key and answers
 * to the same consumer condition. Before the floor, `find({ purpose: "message" })`
 * handed exactly this key to an `AesKit`.
 */
export const TEST_KEY_SIG_MESSAGE = KryptosKit.generate.sig.oct({
  ...defaults,
  algorithm: "HS256",
  createdAt: new Date("2024-01-01T04:00:00.000Z"),
  publish: false,
  purpose: "message",
});

/**
 * A published encryption key — an external recipient's, say. Amphora's own
 * filter defaults to `publish: true`, so this is what an unscoped lookup used to
 * reach for; iris's `publish: false` default now excludes it unless a caller
 * asks for it by name.
 */
export const TEST_KEY_ENC_PUBLISHED = KryptosKit.generate.enc.oct({
  ...defaults,
  algorithm: "dir",
  createdAt: new Date("2024-01-01T05:00:00.000Z"),
  encryption: "A256GCM",
  publish: true,
  purpose: "recipient",
});

/**
 * A key as amphora ingests it from a remote JWKS: the PUBLIC half only. It can
 * encrypt TO a recipient — and never decrypt what it encrypted, which is why
 * `hasPrivateKey` is on the floor. (A public JWK carries no `publish` flag, so
 * it imports as published — hence the `publish: true` in the tests that reach
 * for it.)
 */
export const TEST_KEY_ENC_PUBLIC_ONLY: IKryptos = KryptosKit.from.jwk(
  KryptosKit.generate.enc
    .ec({
      ...defaults,
      algorithm: "ECDH-ES",
      createdAt: new Date("2024-01-01T06:00:00.000Z"),
      curve: "P-256",
      purpose: "recipient",
    })
    .toJWK("public"),
);

/**
 * An env-imported KEK: `KryptosKit.env.import(process.env.KEK!)`. It is NEVER a
 * vault resident, which is the whole point — it is available at class-definition
 * time, so a decorator can name it.
 */
export const TEST_KEY_ENV_KEK = KryptosKit.generate.enc.oct({
  ...defaults,
  algorithm: "dir",
  createdAt: new Date("2024-01-01T07:00:00.000Z"),
  encryption: "A256GCM",
  publish: false,
  purpose: "env",
});

/** An injected key that violates the floor: a signing key handed to a KEK slot. */
export const TEST_KEY_ENV_SIG = KryptosKit.generate.sig.oct({
  ...defaults,
  algorithm: "HS256",
  createdAt: new Date("2024-01-01T08:00:00.000Z"),
  publish: false,
  purpose: "env",
});
