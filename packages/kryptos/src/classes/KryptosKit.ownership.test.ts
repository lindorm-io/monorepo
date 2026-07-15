import { TEST_OCT_KEY_JWK, TEST_OCT_KEY_UTF } from "../__fixtures__/oct-keys.js";
import { KryptosKit } from "./KryptosKit.js";
import { describe, expect, test } from "vitest";

// Provenance (`internal`) is decided by the IMPORT PATH, never by the payload:
// env-provided keys are the service's own; a direct JWK import defaults to NOT
// ours (the remote-JWKS shape); the caller flag overrides explicitly.
describe("KryptosKit ownership", () => {
  test("env.import marks the key as ours", () => {
    const exported = KryptosKit.env.export(KryptosKit.from.jwk(TEST_OCT_KEY_JWK));

    expect(KryptosKit.env.import(exported).internal).toBe(true);
  });

  test("from.jwk defaults to not-ours", () => {
    expect(KryptosKit.from.jwk(TEST_OCT_KEY_JWK).internal).toBe(false);
  });

  // The two JWK-path defaults, asserted as the PAIR they are: a key from someone
  // else's JWKS is not ours AND is a published artifact. `publish: true` is what
  // keeps it visible to amphora's `find()` (which filters `publish: true` by
  // default), so a remote verification key stays usable while staying correctly
  // attributed. Breaking either half breaks foreign-issuer verification.
  test("from.jwk yields a key that is not ours and unpublished by default", () => {
    const kryptos = KryptosKit.from.jwk(TEST_OCT_KEY_JWK);

    // Not ours (the import path decides provenance), and unpublished — publishing
    // is opt-in everywhere. Being external, it stays findable regardless (amphora's
    // filter gates only INTERNAL unpublished keys).
    expect({ internal: kryptos.internal, publish: kryptos.publish }).toEqual({
      internal: false,
      publish: false,
    });
  });

  test("from.jwk honors an explicit provenance flag", () => {
    expect(KryptosKit.from.jwk(TEST_OCT_KEY_JWK, true).internal).toBe(true);
    expect(KryptosKit.from.jwk(TEST_OCT_KEY_JWK, false).internal).toBe(false);
  });

  // THE SECURITY PROPERTY. A remote JWKS is untrusted input: if the payload could
  // set `internal`, any party we fetch keys from could claim to be us — and every
  // consumer predicate that leans on `internal: true` to mean "our own key
  // material" would be answering with the attacker's own assertion.
  test("a payload-borne internal flag does NOT make the key ours", () => {
    const planted = { ...TEST_OCT_KEY_JWK, internal: true } as typeof TEST_OCT_KEY_JWK;

    expect(KryptosKit.from.jwk(planted).internal).toBe(false);
  });

  // Own-key paths mint OUR key material, so they take the constructor default.
  test("generated and own-format imports are ours by default", () => {
    expect(KryptosKit.generate.sig.oct({ algorithm: "HS256" }).internal).toBe(true);
    expect(KryptosKit.from.utf({ ...TEST_OCT_KEY_UTF }).internal).toBe(true);
  });

  // `toDB` writes the flag and `from.db` reads it back, so provenance survives a
  // storage round-trip. Without that, a stored foreign key would come back
  // relabelled as one of ours — provenance laundering by persistence.
  test("provenance round-trips through the DB shape", () => {
    const foreign = KryptosKit.from.jwk(TEST_OCT_KEY_JWK);
    const ours = KryptosKit.from.jwk(TEST_OCT_KEY_JWK, true);

    expect(KryptosKit.from.db(foreign.toDB()).internal).toBe(false);
    expect(KryptosKit.from.db(ours.toDB()).internal).toBe(true);
  });
});
