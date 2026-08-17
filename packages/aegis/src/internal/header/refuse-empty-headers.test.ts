import type { IKryptos } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { describe, expect, test } from "vitest";
import { TEST_EC_KEY_SIG_CERT } from "../../__fixtures__/keys.js";
import { CwsKit } from "../../classes/CwsKit.js";
import { JwsKit } from "../../classes/JwsKit.js";
import { refuseEmptyHeaders } from "./refuse-empty-headers.js";

const logger = createMockLogger();

/**
 * A FOREIGN `IKryptos` — the one live producer of the shape this guard exists
 * for. `IKryptos` is an interface aegis publishes and does not implement, so an
 * implementation that reports a certificate while computing no thumbprint from
 * it is outside every check aegis's own key type already passes: `Kryptos`
 * answers `null` or a real digest, and `resolveCertBinding` throws before it
 * reads a key with no chain at all.
 *
 * It delegates to a REAL cert-bearing key for everything else, so the token is
 * signed with real material and the mint reaches the header build for the same
 * reason a genuine one would.
 */
const emptyThumbprintKey = (kryptos: IKryptos): IKryptos =>
  new Proxy(kryptos, {
    get: (target, property, receiver) =>
      property === "certificateThumbprint" ? "" : Reflect.get(target, property, receiver),
  });

describe("refuseEmptyHeaders", () => {
  test("should refuse the empty value of a parameter the registry says refuse", () => {
    expect(() => refuseEmptyHeaders({ "x5t#S256": "" })).toThrow(
      expect.objectContaining({
        code: "header_empty_parameter",
        data: { parameter: "x5t#S256", whenEmpty: "refuse" },
      }),
    );
  });

  /**
   * ⚠ EMPTY IS WHAT `isEmpty` CALLS EMPTY, and the boundary is the same one the
   * prune keeps: `""`, `null`, `[]`, `{}`. NOT `0`, NOT `false`, and NOT a
   * zero-length Buffer — those are values, and a parameter carrying one has said
   * something, however useless.
   */
  test.each([null, [], {}])("should refuse the empty form %s", (value) => {
    expect(() => refuseEmptyHeaders({ "x5t#S256": value })).toThrow(
      expect.objectContaining({ code: "header_empty_parameter" }),
    );
  });

  test("should pass a real value through", () => {
    expect(() => refuseEmptyHeaders({ "x5t#S256": "dGh1bWJwcmludA" })).not.toThrow();
  });

  /**
   * The two parameters that sit beside it and PRUNE, plus an UNREGISTERED key.
   * The guard reads ONE column and refuses on ONE answer, so everything else has
   * to leave here untouched — including a key with no entry, which has answered
   * nothing and is disposed of by the closed-set rule instead.
   */
  test("should refuse nothing else, registered or not", () => {
    expect(() =>
      refuseEmptyHeaders({ x5t: "", x5c: [], cty: "", crit: [], nonsense: "" }),
    ).not.toThrow();
  });

  /**
   * ⭐ THE BOUNDARY. This is the only path that reaches the cell with a key aegis
   * will actually sign with, and it is why the verdict is `refuse` rather than
   * `keep` or `prune`: the alternative to throwing here is a token that either
   * states a binding no certificate satisfies or states none at all, and the
   * producer would learn about neither.
   *
   * ⚠ JOSE ONLY, and NOT because the guard is wire-scoped — it lives in the
   * normalisation both wires share, and the row below shows both refuse a
   * caller-supplied empty thumbprint. It is because the KEY-DERIVED tier does not
   * exist on COSE: `resolveCertBinding` has no COSE caller, so no COSE writer
   * ever asks a kryptos for a thumbprint and there is no value for this cell to
   * catch. When COSE gains a certificate binding, this row gains a COSE half.
   */
  test("a key that reports a certificate but no thumbprint is refused at mint", () => {
    expect(() =>
      new JwsKit({ logger, kryptos: emptyThumbprintKey(TEST_EC_KEY_SIG_CERT) }).sign(
        "data",
      ),
    ).toThrow(
      expect.objectContaining({
        code: "header_empty_parameter",
        data: { parameter: "x5t#S256", whenEmpty: "refuse" },
      }),
    );
  });

  test("the same key with its real thumbprint still mints", () => {
    // The control. Without it the row above is satisfied by a guard that refuses
    // every cert-bearing key, which is a different and much worse behaviour.
    expect(() =>
      new JwsKit({ logger, kryptos: TEST_EC_KEY_SIG_CERT }).sign("data"),
    ).not.toThrow();
  });

  /**
   * The CALLER-SUPPLIED half, which is where both wires do meet. `x5t#S256` is
   * Omit'd from the caller's bag type, so reaching it needs an untyped caller —
   * and the refusal must still be the same one on both encodings, because the
   * normalisation runs upstream of either wire's own disposal of the parameter.
   * Without the guard, JOSE answers `jose_reserved_header` and COSE answers
   * `header_no_cose_label`: two verdicts for one call, chosen by encoding.
   */
  test("an untyped caller's empty thumbprint is refused identically on both wires", () => {
    const header = { "x5t#S256": "" } as never;

    expect(() =>
      new JwsKit({ logger, kryptos: TEST_EC_KEY_SIG_CERT }).sign("data", { header }),
    ).toThrow(
      expect.objectContaining({
        code: "header_empty_parameter",
        data: { parameter: "x5t#S256", whenEmpty: "refuse" },
      }),
    );

    expect(() =>
      new CwsKit({ logger, kryptos: TEST_EC_KEY_SIG_CERT }).sign(Buffer.from("data"), {
        header,
      }),
    ).toThrow(
      expect.objectContaining({
        code: "header_empty_parameter",
        data: { parameter: "x5t#S256", whenEmpty: "refuse" },
      }),
    );
  });
});
