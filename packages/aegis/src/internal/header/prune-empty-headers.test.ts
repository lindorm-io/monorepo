import { describe, expect, test } from "vitest";
import { pruneEmptyHeaders } from "./prune-empty-headers.js";

/**
 * The prune's OWN contract, stated on its own account — the sibling of
 * `refuse-empty-headers.test.ts`, which is the other half of the one column
 * ({@link HeaderSpec.whenEmpty}) these two functions divide between them.
 *
 * ⚠ WHY THIS FILE EXISTS, said honestly rather than oversold. The end-to-end
 * guarantee is NOT unguarded: `normaliseHeaders` runs the refusal FIRST, so a
 * `refuse` cell never reaches this function with an empty value, and widening the
 * test below's condition while ALSO reordering the two steps is caught loudly —
 * both cells of the certificate-binding row go red, plus six unit rows. What is
 * not caught is either half ALONE: reorder the steps and nothing moves, because
 * this function reads `=== "prune"` and declines; widen this function to "anything
 * but keep" and nothing moves, because the refusal already threw. Two files, each
 * relying on the other to be wrong-proof, and no row saying what either one
 * promises by itself.
 *
 * So this file pins the UNIT-level contract: what this function does when handed a
 * bag directly, independent of who normalised it first. It is the only file in
 * `internal/header/` that had a production reader and no test beside it.
 */
describe("pruneEmptyHeaders", () => {
  test("prunes the empty value of a parameter the registry says prune", () => {
    expect(pruneEmptyHeaders({ cty: "", crit: [], oid: "", x5u: "", jwk: {} })).toEqual(
      {},
    );
  });

  test("passes a real value through", () => {
    expect(pruneEmptyHeaders({ cty: "application/json", kid: "key_test" })).toEqual({
      cty: "application/json",
      kid: "key_test",
    });
  });

  /**
   * ⭐ THE CELL THIS FUNCTION DOES NOT OWN. `x5t#S256` is the one `refuse` cell,
   * and its empty value is `refuse-empty-headers.ts`'s verdict, not this one's —
   * so this function must leave it EXACTLY where it found it rather than treat
   * "not keep" as "prune".
   *
   * The distinction is what stops the binding from being lost silently: pruning
   * an unsatisfiable certificate binding converts it into NO binding and hands the
   * audience a token the issuer meant to constrain. That refusal only ever fires
   * if this function declines to answer first.
   */
  test("leaves the one refuse cell exactly as it found it", () => {
    expect(pruneEmptyHeaders({ "x5t#S256": "" })).toEqual({ "x5t#S256": "" });
    expect(pruneEmptyHeaders({ "x5t#S256": null, kid: "key_test" })).toEqual({
      "x5t#S256": null,
      kid: "key_test",
    });
  });

  /**
   * Rule 2: an UNREGISTERED key has no cell, so it has answered nothing and this
   * function has no verdict to apply. The closed-set rule disposes of it instead —
   * DROPPED by the two JOSE passes, REFUSED with `header_no_cose_label` by the COSE
   * one. Pruning it here would make an empty-valued unregistered parameter vanish
   * before it reached the refusal a COSE caller must hear.
   */
  test("never touches an unregistered key, empty or not", () => {
    expect(
      pruneEmptyHeaders({ nonsense: "", empty_list: [], empty_map: {}, kept: 1 }),
    ).toEqual({ nonsense: "", empty_list: [], empty_map: {}, kept: 1 });
  });

  /**
   * TOP LEVEL only. A registered parameter's inner members are its own declared
   * structure — a JWK's coordinates here — which the registry does not describe,
   * so recursing would be rule 2 broken one level down.
   */
  test("does not recurse into a registered parameter's own structure", () => {
    expect(pruneEmptyHeaders({ jwk: { kty: "EC", crv: "P-256", x: "" } })).toEqual({
      jwk: { kty: "EC", crv: "P-256", x: "" },
    });
  });

  /**
   * The `isEmpty` boundary, pinned against the whole `!value` family of
   * "simplifications". `0` and `false` are VALUES, and a zero-length Buffer is
   * bytes: a zero PBES2 iteration count must fail where the derivation happens and
   * a zero-length nonce must fail in the AEAD, neither of them quietly removed
   * from a header the recipient needs in order to reproduce the operation.
   */
  test("keeps zero, false and a zero-length buffer", () => {
    expect(pruneEmptyHeaders({ p2c: 0, iv: Buffer.alloc(0) })).toEqual({
      p2c: 0,
      iv: Buffer.alloc(0),
    });
  });

  /**
   * INSERTION ORDER survives, because the dict is walked and not the registry.
   * The wire bytes are order-sensitive and the corpus pins them, so a rewrite that
   * iterated the registry instead would reorder every header it touched while
   * every assertion about CONTENT stayed green.
   */
  test("preserves the surviving keys' insertion order", () => {
    expect(
      Object.keys(pruneEmptyHeaders({ typ: "JWT", cty: "", kid: "key_test", oid: "" })),
    ).toEqual(["typ", "kid"]);
  });
});
