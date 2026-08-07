import type { IKryptos, KryptosEncryption } from "@lindorm/kryptos";

export type AesKitSettings = {
  /**
   * The content-encryption AEAD to use for a key that DECLARES NONE — a
   * fallback, never an override. A key that declares its own `encryption` wins,
   * because the declaration is what the key IS: for `dir` the secret is sized
   * for it (a 48-byte secret is `A192CBC-HS384` and nothing else), and for a
   * key-wrapping algorithm it is the content algorithm the key states it is
   * held for.
   *
   * A recipient key imported from a peer's JWKS declares nothing — `enc` is not
   * a JWK member — which is the case this exists for. Omitted ⇒ `A256GCM`.
   */
  defaultEncryption?: KryptosEncryption;
  kryptos: IKryptos;
};
