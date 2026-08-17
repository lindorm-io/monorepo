import { describe, expect, test } from "vitest";
import { mapTokenHeader, shapeWireHeader } from "../utils/token-header.js";
import { normaliseHeaders } from "./normalise-headers.js";

describe("normaliseHeaders", () => {
  // Strip 1: `undefined` is the absent property of a bag assembled from optional
  // fields. Every other value was written by someone, and only the registry says
  // which of those writings carry nothing.
  describe("the undefined strip", () => {
    test("should strip undefined and keep an unregistered key's every other value", () => {
      expect(
        normaliseHeaders({ a: 1, b: null, c: "", d: undefined, e: [], f: {} }),
      ).toMatchSnapshot();
    });

    /**
     * ⭐ ABSENT IS NOT EMPTY, and the strip has to run FIRST for that to be true.
     * `isEmpty(undefined)` is `true`, so a `refuse` cell reached before the strip
     * would answer a bag that merely OMITS the parameter — every kit assembling a
     * header from optional fields spreads exactly such a bag, and each one would
     * throw for a parameter nobody asked to set.
     *
     * ⚠ It is the ORDER that is pinned here, not the strip: `x5t#S256` is the one
     * `whenEmpty: "refuse"` cell, so it is the only parameter whose absence can be
     * mistaken for an unhonourable emptiness at all. The day a second parameter
     * takes that cell, this row already covers it — which is the point of stating
     * the rule on the one that has it.
     */
    test("an ABSENT refuse-cell parameter is absent, never an empty one", () => {
      expect(normaliseHeaders({ "x5t#S256": undefined })).toEqual({});
      expect(normaliseHeaders({ "x5t#S256": undefined, kid: "key_test" })).toEqual({
        kid: "key_test",
      });
    });

    test("should leave a registered parameter's own structure alone", () => {
      // TOP LEVEL only: a JWK's members are the JWK's declared structure, not the
      // registry's, so the strip that rebuilds the object must not prune inside it.
      expect(
        normaliseHeaders({ jwk: { kty: "EC", crv: "P-256", x: "" }, kid: "key_test" }),
      ).toMatchSnapshot();
    });
  });

  describe("the registry-driven empty prune", () => {
    // The `whenEmpty: "prune"` cells. `crit: []` is the one both wires forbid
    // outright (RFC 7515 §4.1.11, RFC 9052 §3.1) and aegis's own reader refuses;
    // `cty: ""` is the one that decided a payload's serialisation.
    test("should prune a registered parameter the registry marks prunable", () => {
      expect(
        normaliseHeaders({
          crit: [],
          cty: "",
          oid: "",
          x5u: "",
          zip: "",
          jwk: {},
          kid: "key_test",
        }),
      ).toMatchSnapshot();
    });

    /**
     * The ONE `refuse`, and the test that stops a future sweep from
     * pattern-matching the certificate trio into uniformity. `x5t#S256` is the
     * only header parameter aegis's verify enforces (`verify-cert-binding.ts`):
     * it skips the check when the parameter is ABSENT and refuses a mismatch
     * when it is present, so presence IS the binding. An empty thumbprint has
     * neither disposal available — pruning it converts an unsatisfiable binding
     * into no binding at all, and keeping it emits a token every recipient must
     * reject — so the write refuses. `x5t` and `x5c` sit beside it and prune,
     * because nothing reads either.
     */
    test("should refuse the empty thumbprint aegis binds on", () => {
      expect(() => normaliseHeaders({ "x5t#S256": "", kid: "key_test" })).toThrow(
        expect.objectContaining({
          code: "header_empty_parameter",
          data: { parameter: "x5t#S256", whenEmpty: "refuse" },
        }),
      );
    });

    test("should prune the two certificate parameters nothing reads", () => {
      expect(normaliseHeaders({ x5t: "", x5c: [], kid: "key_test" })).toMatchSnapshot();
    });

    /**
     * Rule 2 of the prune: headers are a CLOSED set, and the closed-set rule is
     * what disposes of an unregistered key — DROPPED by the two JOSE passes,
     * REFUSED with `header_no_cose_label` by the COSE one. If the prune took it
     * first, an empty-valued unregistered parameter would vanish silently instead
     * of reaching the refusal a caller must hear.
     */
    test("should never prune an unregistered key", () => {
      expect(
        normaliseHeaders({ nonsense: "", empty_list: [], empty_map: {}, kept: 1 }),
      ).toMatchSnapshot();
    });

    /**
     * The `isEmpty` boundary, pinned against the whole `!value` family of
     * "simplifications". `0` and `false` are VALUES — a zero PBES2 iteration count
     * is a key-management defect that must fail where the derivation happens, not
     * vanish from the header a recipient needs to reproduce it — and a zero-length
     * Buffer is bytes, so a zero-length nonce must fail in the AEAD rather than be
     * pruned into "no IV".
     */
    test("should keep zero, false and a zero-length buffer", () => {
      expect(
        normaliseHeaders({ p2c: 0, iv: Buffer.alloc(0), flag: false }),
      ).toMatchSnapshot();
    });

    /**
     * ⚠ THE PRUNE IS CRIT-BLIND, and nothing here needs to know otherwise. A
     * producer that marks a parameter critical while giving it nothing to
     * understand is refused OUTRIGHT at the two builders
     * (`assert-crit-satisfied.ts`), so no header carrying a crit-named empty
     * value ever reaches an emission boundary — there is no referent left for a
     * prune to strip out from under. The exemption this replaced had to be told
     * which bag, which bucket, which tier and which vocabulary it was reasoning
     * about, and it was wrong on all four; a fragment cannot answer a question
     * about the message it is part of.
     */
    test("should prune an empty parameter even where this header's own crit names it", () => {
      expect(normaliseHeaders({ crit: ["oid"], oid: "", cty: "" })).toMatchSnapshot();
    });

    /**
     * IDEMPOTENT, and it has to be: a bag is normalised where it ENTERS — the
     * domain crossing (`mapTokenHeader`) for a domain-named bag, the OPAQUE-CONTENT
     * kit door for a wire-named one, because those four doors read the caller's
     * `cty` before the header is assembled (the three CLAIMS doors read nothing off
     * the bag and take no call) — and again at the emission boundary
     * (`shapeWireHeader`). They
     * all consult the same registry cell through the same JOSE-name lookup, so
     * they cannot disagree.
     *
     * ⚠ IT IS THE TWO CALL SITES THAT ARE PINNED, not the function against itself.
     * Re-running a copy-survivors filter over its own output is idempotent BY
     * CONSTRUCTION — that test could not redden for any implementation of this
     * file, so it stated nothing. What can go wrong is the two crossings
     * disagreeing about what "emits nothing" means, and the domain pass reaching a
     * DIFFERENT registry row than the wire pass is exactly how: they look a
     * parameter up by different names (`contentType` vs `cty`).
     */
    test("the domain crossing and the emission boundary normalise identically", () => {
      // ⚠ CALLER-SUPPLIED parameters only. The certificate trio — where the one
      // `whenEmpty: "refuse"` cell lives — cannot take part: `mapTokenHeader` writes
      // those three from its `cert` argument, which OVERRIDES anything a caller put
      // in the domain bag, so an empty `certificateThumbprint` never survives the
      // domain crossing to be compared. That is the same reachability the write
      // path already states, not a disagreement between the passes.
      expect(
        mapTokenHeader({
          contentType: "",
          critical: [],
          objectId: "",
          certificateUrl: "",
          keyId: "key_test",
        }),
      ).toEqual(
        shapeWireHeader({
          cty: "",
          crit: [],
          oid: "",
          x5u: "",
          kid: "key_test",
        } as never),
      );
    });
  });
});
