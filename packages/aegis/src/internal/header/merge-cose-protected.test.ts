import { describe, expect, test } from "vitest";
import { decodeCbor } from "../cose/cbor.js";
import { mergeCoseProtected } from "./merge-cose-protected.js";

const decode = (bstr: Buffer): Map<number | string, unknown> =>
  decodeCbor<Map<number | string, unknown>>(bstr);

describe("mergeCoseProtected", () => {
  test("writes alg (1), cty (3) and typ (16)", () => {
    const map = decode(
      mergeCoseProtected({
        alg: -36,
        typ: "application/at+cwt",
        cty: "application/json",
        entries: new Map(),
        proprietary: false,
      }),
    );

    expect(map.get(1)).toBe(-36);
    expect(map.get(3)).toBe("application/json");
    expect(map.get(16)).toBe("application/at+cwt");
  });

  test("the encoding is DETERMINISTIC — labels sorted, whatever the write order", () => {
    // `encodeCbor` emits CDE (RFC 8949 §4.2.1), so insertion order never reaches
    // the wire. Merge order is precedence only.
    const map = decode(
      mergeCoseProtected({
        alg: -36,
        typ: "application/at+cwt",
        cty: "application/json",
        entries: new Map<number | string, unknown>([[33, "x5chain"]]),
        proprietary: false,
      }),
    );

    expect([...map.keys()]).toEqual([1, 3, 16, 33]);
  });

  test("a caller cty OVERWRITES the inferred one", () => {
    // `cty` is settable — the content codec has already honoured the caller's
    // label — so the caller's entry, written last, wins.
    const map = decode(
      mergeCoseProtected({
        alg: -36,
        typ: "application/at+cwt",
        cty: "application/json",
        entries: new Map<number | string, unknown>([[3, "application/cwt"]]),
        proprietary: false,
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
    const map = decode(
      mergeCoseProtected({
        alg: -36,
        typ: "application/cwt",
        entries: new Map(),
        proprietary: false,
      }),
    );

    expect(map.has(3)).toBe(false);
    expect([...map.keys()]).toEqual([1, 16]);
  });

  // …and a caller entry is then the ONLY source of it, which is how a claims kit
  // still declares a NESTED token (RFC 8392 Appendix A.6).
  test("an omitted cty leaves a caller entry as the only label 3", () => {
    const map = decode(
      mergeCoseProtected({
        alg: -36,
        typ: "application/cwt",
        entries: new Map<number | string, unknown>([[3, "application/cwt"]]),
        proprietary: false,
      }),
    );

    expect(map.get(3)).toBe("application/cwt");
  });

  test("returns the ENCODED protected byte string, never the map", () => {
    expect(
      Buffer.isBuffer(
        mergeCoseProtected({
          alg: -7,
          typ: "JWE",
          cty: "text/plain",
          entries: new Map(),
          proprietary: false,
        }),
      ),
    ).toBe(true);
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
      mergeCoseProtected({
        alg: -36,
        typ: "application/at+cwt",
        cty: "application/json",
        entries: new Map(),
        proprietary,
      }).toString("hex");

    expect(encoded(false)).toBe(encoded(true));
  });
});
