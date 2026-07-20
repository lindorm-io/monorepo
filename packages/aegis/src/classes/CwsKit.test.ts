import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { describe, expect, test } from "vitest";
import { AegisError } from "../errors/index.js";
import { TEST_EC_KEY_SIG } from "../__fixtures__/keys.js";
import { decodeCbor, encodeCbor } from "../internal/cose/cbor.js";
import { COSE_TAG } from "../internal/cose/structures.js";
import { CwsKit } from "./CwsKit.js";

// The sole opaque COSE signer: it produces a COSE_Sign1 (tag 18) for an
// asymmetric key and a COSE_Mac0 (tag 17) for a symmetric one, gating on the
// key's `algClass` itself.
describe("CwsKit — asymmetric key produces a COSE_Sign1 (tag 18)", () => {
  const kit = new CwsKit({ kryptos: TEST_EC_KEY_SIG, logger: createMockLogger() });

  test("round-trips a payload through sign -> CBOR -> verify", () => {
    const payload = Buffer.from("the cwt claims bytes");

    const sign1 = kit.sign(payload, { typ: "application/at+cwt" });
    expect(sign1.tag).toBe(COSE_TAG.sign1);

    const { payload: out } = kit.verify(decodeCbor(encodeCbor(sign1)));
    expect(out.equals(payload)).toBe(true);
  });

  test("rejects a tampered payload", () => {
    const sign1 = kit.sign(Buffer.from("authentic"));
    const arr = sign1.contents as Array<Buffer>;
    const tampered = Buffer.from(arr[3]); // the signature
    tampered[0] ^= 0xff;
    arr[3] = tampered;

    expect(() => kit.verify(sign1)).toThrow(AegisError);
  });
});

describe("CwsKit — symmetric key produces a COSE_Mac0 (tag 17)", () => {
  const kryptos = KryptosKit.generate.sig.oct({ algorithm: "HS256" });
  const kit = new CwsKit({ kryptos, logger: createMockLogger() });

  test("round-trips a payload through mac -> CBOR -> verify", () => {
    const payload = Buffer.from("the cwt claims bytes");

    const mac0 = kit.sign(payload, { typ: "application/at+cwt" });
    expect(mac0.tag).toBe(COSE_TAG.mac0);

    const { payload: out, protectedHeader } = kit.verify(decodeCbor(encodeCbor(mac0)));
    expect(out.equals(payload)).toBe(true);
    expect(protectedHeader.get(1)).toBe(5); // HS256 label
  });

  test("rejects a tampered payload", () => {
    const mac0 = kit.sign(Buffer.from("authentic"));
    const arr = mac0.contents as Array<Buffer>;
    const tampered = Buffer.from(arr[2]); // the payload
    tampered[0] ^= 0xff;
    arr[2] = tampered;

    expect(() => kit.verify(mac0)).toThrow(AegisError);
  });
});

describe("CwsKit — proprietary alg gate", () => {
  // ML-DSA (post-quantum, AKP) is a reachable kryptos signing algorithm with NO
  // official COSE registration — private-use. Proprietary is the DEFAULT, so it
  // is allowed unless the caller opts into interop mode (`proprietary: false`),
  // which refuses it; verify is always lenient.
  const kryptos = KryptosKit.generate.sig.akp({ algorithm: "ML-DSA-44" });
  const kit = new CwsKit({ kryptos, logger: createMockLogger() });

  test("interoperable sign (proprietary:false) refuses ML-DSA (no official COSE label)", () => {
    const error = (() => {
      try {
        kit.sign(Buffer.from("the cwt claims bytes"), { proprietary: false });
      } catch (err) {
        return err as AegisError;
      }
    })();

    expect(error).toBeInstanceOf(AegisError);
    expect(error?.code).toBe("cose_alg_not_registered");
  });

  test("default (proprietary) sign allows ML-DSA and round-trips through verify", () => {
    const payload = Buffer.from("the cwt claims bytes");

    const sign1 = kit.sign(payload);
    expect(sign1.tag).toBe(COSE_TAG.sign1);
    // The private-use ML-DSA alg label sits below the COSE private-use floor.
    const protectedHeader = decodeCbor<Map<number, unknown>>(
      (sign1.contents as Array<Buffer>)[0],
    );
    expect(protectedHeader.get(1)).toBeLessThan(-65536);

    // Verify is ALWAYS lenient — it reads the private-use label back with no flag.
    const { payload: out } = kit.verify(decodeCbor(encodeCbor(sign1)));
    expect(out.equals(payload)).toBe(true);
  });
});
