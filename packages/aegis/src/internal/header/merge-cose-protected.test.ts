import { describe, expect, test } from "vitest";
import { CwtError } from "../../errors/index.js";
import { decodeCbor } from "../cose/cbor.js";
import { mergeCoseProtected } from "./merge-cose-protected.js";

const decode = (bstr: Buffer): Map<number | string, unknown> =>
  decodeCbor<Map<number | string, unknown>>(bstr);

/**
 * `format` and `error` reach every call because this function is where the COSE
 * protected bucket becomes COMPLETE, and therefore where the `crit` satisfaction
 * check runs — see the last describe block.
 */
const merge = (
  overrides: Partial<Parameters<typeof mergeCoseProtected>[0]> = {},
): Buffer =>
  mergeCoseProtected({
    alg: -36,
    typ: "application/at+cwt",
    entries: new Map(),
    proprietary: false,
    format: "cwt",
    error: CwtError,
    ...overrides,
  });

describe("mergeCoseProtected", () => {
  test("writes alg (1), cty (3) and typ (16)", () => {
    const map = decode(merge({ cty: "application/json" }));

    expect(map.get(1)).toBe(-36);
    expect(map.get(3)).toBe("application/json");
    expect(map.get(16)).toBe("application/at+cwt");
  });

  test("the encoding is DETERMINISTIC — labels sorted, whatever the write order", () => {
    // `encodeCbor` emits CDE (RFC 8949 §4.2.1), so insertion order never reaches
    // the wire. Merge order is precedence only.
    const map = decode(
      merge({
        cty: "application/json",
        entries: new Map<number | string, unknown>([[33, "x5chain"]]),
      }),
    );

    expect([...map.keys()]).toEqual([1, 3, 16, 33]);
  });

  test("a caller cty OVERWRITES the inferred one", () => {
    // `cty` is settable — the content codec has already honoured the caller's
    // label — so the caller's entry, written last, wins.
    const map = decode(
      merge({
        cty: "application/json",
        entries: new Map<number | string, unknown>([[3, "application/cwt"]]),
      }),
    );

    expect(map.get(3)).toBe("application/cwt");
    expect(map.size).toBe(3);
  });

  // The CLAIMS writers derive no content type at all — RFC 8392 §7.2 reads a CWT
  // payload as a CBOR map with no cty-driven decode — so label 3 has to be
  // OMITTABLE, not merely settable to something. Writing a placeholder would put
  // an untrue statement about the payload on the wire.
  test("an omitted cty writes NO label 3", () => {
    const map = decode(merge({ typ: "application/cwt" }));

    expect(map.has(3)).toBe(false);
    expect([...map.keys()]).toEqual([1, 16]);
  });

  // …and a caller entry is then the ONLY source of it, which is how a claims kit
  // still declares a NESTED token (RFC 8392 Appendix A.6).
  test("an omitted cty leaves a caller entry as the only label 3", () => {
    const map = decode(
      merge({
        typ: "application/cwt",
        entries: new Map<number | string, unknown>([[3, "application/cwt"]]),
      }),
    );

    expect(map.get(3)).toBe("application/cwt");
  });

  test("returns the ENCODED protected byte string, never the map", () => {
    expect(Buffer.isBuffer(merge({ alg: -7, typ: "JWE", cty: "text/plain" }))).toBe(true);
  });

  // The interop mode reaches here so that ONE resolver spells every parameter
  // this function writes, not because it currently changes any of them: `alg`
  // (1), `typ` (16) and `cty` (3) are all REGISTERED labels, and only a
  // PRIVATE-USE one (< -65536) degrades to its string spelling. Asserting the
  // two modes agree BYTE FOR BYTE states that, and fails the day a derived
  // parameter is given a private-use label without the callers being told —
  // which would put the one uninterpretable label on an interoperable token.
  test("the interop mode changes nothing here — every derived parameter is REGISTERED", () => {
    const encoded = (proprietary: boolean): string =>
      merge({ cty: "application/json", proprietary }).toString("hex");

    expect(encoded(false)).toBe(encoded(true));
  });

  /**
   * ⚠ THE BUCKET IS COMPLETE HERE, AND NOWHERE EARLIER. `buildCoseHeaders` sees
   * the caller's translated entries alone; `alg`, `typ` and `cty` are written by
   * this function. A `crit` is a statement about the FINISHED bucket (RFC 9052
   * §3.1: a crit label whose parameter is not in the protected-header-parameters
   * bucket is "a fatal error in processing the message"), so asked one step
   * earlier it refused headers whose protected bucket does carry the parameter —
   * and refused them only on this wire, while the JOSE twin minted the same call.
   *
   * These four are exactly the parameters that distinguish the fragment from the
   * message: three this function writes (1/16/3) and one it does not (`kid`, 4).
   */
  describe("the crit satisfaction check runs on the COMPLETE bucket", () => {
    test("a crit naming alg (1) is satisfied by THIS function's own write", () => {
      const map = decode(
        merge({ entries: new Map<number | string, unknown>([[2, [1]]]) }),
      );

      expect(map.get(2)).toEqual([1]);
      expect(map.get(1)).toBe(-36);
    });

    test("a crit naming typ (16) is satisfied by THIS function's own write", () => {
      expect(decode(merge({ entries: new Map([[2, [16]]]) })).get(2)).toEqual([16]);
    });

    test("a crit naming cty (3) is satisfied when this wire derives one", () => {
      expect(
        decode(merge({ cty: "application/json", entries: new Map([[2, [3]]]) })).get(2),
      ).toEqual([3]);
    });

    // …and refused when it does not, which is the same rule reading a different
    // bucket rather than a second rule: the claims wires write no label 3 at all.
    test("a crit naming cty (3) is refused when this wire derives none", () => {
      expect(() => merge({ entries: new Map([[2, [3]]]) })).toThrow(
        expect.objectContaining({ code: "cwt_invalid_crit" }),
      );
    });

    test("a crit naming a parameter no bucket provides is refused", () => {
      expect(() => merge({ entries: new Map([[2, ["oid"]]]) })).toThrow(
        /crit listed parameter "oid" carries no value in the protected header/,
      );
    });

    test("a crit naming a parameter with an EMPTY value is refused", () => {
      // The check reads the VALUE, not the key, so an empty value gets the same
      // verdict as an absent one.
      // ⚠ No aegis write path can hand this bucket over TODAY: `oid` prunes, and
      // the one `whenEmpty: "keep"` cell (`x5t#S256`) has no COSE label at all, so
      // `coseWireKey` refuses it with `header_no_cose_label` long before it could
      // reach here. `entries` is a parameter, though — this states the contract
      // the caller of that parameter is held to, whoever it comes to be.
      expect(() =>
        merge({
          entries: new Map<number | string, unknown>([
            [2, ["oid"]],
            ["oid", ""],
          ]),
        }),
      ).toThrow(/crit listed parameter "oid" carries no value in the protected header/);
    });

    // ⚠ `kid` (4) is the one parameter the two wires legitimately answer
    // differently, and it is a fact about the STRUCTURES, not about this check: a
    // JOSE compact serialisation has ONE header (RFC 7515 §7.1) and carries `kid`
    // in it, while COSE puts the kit's `kid` in the UNPROTECTED bucket, where RFC
    // 9052 §3.1 makes a crit naming it a fatal error for every recipient. Minting
    // it would be minting a token no COSE reader accepts.
    test("a crit naming the kit's UNPROTECTED kid (4) is refused", () => {
      expect(() => merge({ entries: new Map([[2, [4]]]) })).toThrow(
        expect.objectContaining({
          code: "cwt_invalid_crit",
          data: { crit: [4], parameter: 4 },
        }),
      );
    });

    test("the refusal names the FORMAT it came from", () => {
      // `format` decides the error code alone, so a mis-threaded tag is otherwise
      // invisible — the kits' own codes are pinned in `assert-crit-satisfied.test.ts`.
      expect(() => merge({ format: "cws", entries: new Map([[2, ["oid"]]]) })).toThrow(
        expect.objectContaining({ code: "cws_invalid_crit" }),
      );
    });

    test("a bucket with no crit at all is untouched", () => {
      expect(decode(merge()).has(2)).toBe(false);
    });
  });
});
