import { B64 } from "@lindorm/b64";
import { KryptosKit } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import { describe, expect, test } from "vitest";
import { B64U } from "../constants/format.js";
import { coseKeyToJwk, jwkToCoseKey } from "./cose-key.js";

// COSE_Key labels (RFC 9052 §7 + RFC 9964 §5): kty = 1, and for AKP (kty 7) the
// raw public key `pub` = -1 and the 32-byte seed `priv` = -2, both bstr.
const KTY = 1;
const AKP_PUB = -1;
const AKP_PRIV = -2;
const AKP_KTY = 7;
const ML_DSA_SEED_SIZE = 32;

describe("AKP COSE_Key (RFC 9964)", () => {
  test("a private ML-DSA JWK maps to kty 7 with pub@-1 and the seed at priv@-2", () => {
    const jwk = KryptosKit.generate.sig.akp({ algorithm: "ML-DSA-65" }).toJWK("private");

    const key = jwkToCoseKey(jwk as Dict);

    expect(key.get(KTY)).toBe(AKP_KTY);

    const pub = key.get(AKP_PUB);
    expect(pub).toBeInstanceOf(Buffer);
    expect((pub as Buffer).equals(B64.toBuffer(jwk.pub as string, B64U))).toBe(true);

    const priv = key.get(AKP_PRIV);
    expect(priv).toBeInstanceOf(Buffer);
    expect((priv as Buffer).length).toBe(ML_DSA_SEED_SIZE);
    expect((priv as Buffer).equals(B64.toBuffer(jwk.priv as string, B64U))).toBe(true);
  });

  test("a public-only ML-DSA JWK omits the priv label", () => {
    const jwk = KryptosKit.generate.sig.akp({ algorithm: "ML-DSA-44" }).toJWK("public");

    const key = jwkToCoseKey(jwk as Dict);

    expect(key.get(KTY)).toBe(AKP_KTY);
    expect(key.has(AKP_PUB)).toBe(true);
    expect(key.has(AKP_PRIV)).toBe(false);
  });

  test("round-trips a private ML-DSA key jwk -> COSE_Key -> jwk", () => {
    const jwk = KryptosKit.generate.sig.akp({ algorithm: "ML-DSA-87" }).toJWK("private");

    const back = coseKeyToJwk(jwkToCoseKey(jwk as Dict));

    expect(back.kty).toBe("AKP");
    expect(back.pub).toBe(jwk.pub);
    expect(back.priv).toBe(jwk.priv);
  });

  test("round-trips a public-only ML-DSA key with no priv", () => {
    const jwk = KryptosKit.generate.sig.akp({ algorithm: "ML-DSA-65" }).toJWK("public");

    const back = coseKeyToJwk(jwkToCoseKey(jwk as Dict));

    expect(back.kty).toBe("AKP");
    expect(back.pub).toBe(jwk.pub);
    expect(back.priv).toBeUndefined();
  });

  test("rejects an AKP JWK with no pub", () => {
    expect(() => jwkToCoseKey({ kty: "AKP" })).toThrow(
      expect.objectContaining({ code: "cose_key_unsupported" }),
    );
  });
});
