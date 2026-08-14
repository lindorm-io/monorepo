import { Amphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { Dict } from "@lindorm/types";
import MockDate from "mockdate";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  TEST_EC_KEY_ENC_CERT,
  TEST_EC_KEY_SIG_CERT,
  TEST_OCT_KEY_ENC,
} from "../../__fixtures__/keys.js";
import { Aegis } from "../../classes/Aegis.js";
import { CweKit } from "../../classes/CweKit.js";
import { CwsKit } from "../../classes/CwsKit.js";
import { CwtKit } from "../../classes/CwtKit.js";
import { JweKit } from "../../classes/JweKit.js";
import { JwsKit } from "../../classes/JwsKit.js";
import { JwtKit } from "../../classes/JwtKit.js";
import type { AegisDeps } from "../utils/aegis-deps.js";
import { COSE_TOKEN_WIRE } from "./cose-token-wire.js";
import { JOSE_TOKEN_WIRE } from "./jose-token-wire.js";
import type { TokenWire, WireInputDispositions } from "./token-wire.js";
import type { Disposition } from "./wire-input-disposition.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

/**
 * THE PROOF that the disposition tables are not merely a claim.
 *
 * A wire declares what it does with each of its kit's options, and both halves
 * of that declaration are run here rather than read:
 *
 * - `forwarded` — the operation is driven AT THE SEAM with a sentinel in every
 *   forwarded field, the kit method is spied, and each field is required to have
 *   ARRIVED with the caller's own value. This half is deliberately below the
 *   domain verbs: several kit options (`unprotected`, and `proprietary` on the
 *   opaque sign path) have no domain door at all, so a probe driven from
 *   `aegis.*` could not reach them. What the domain doors forward is the knob
 *   matrix's subject; what the WIRE forwards is this one's.
 * - `unsupported` — driven through the REAL domain verb, because the guard runs
 *   above the seam and a caller is the only thing that can trip it. A supplied
 *   value must be REFUSED; a value the row `honours` must not be.
 *
 * ⛔ Delete a field from a wire's forward and this goes red. That is the whole
 * point: the rest-spread makes the drop unexpressible, and this proves the
 * spread is still what is there.
 */
describe("wire input dispositions", () => {
  /**
   * One TEST-OWNED value per kit option, distinguishable from anything the
   * production code would default to. ⛔ Never read from the source's own
   * constants — a sentinel that agrees with the default proves nothing.
   */
  const SENTINEL: Dict = {
    header: { oid: "1.2.3.4" },
    unprotected: { oid: "1.2.3.5" },
    tokenType: "probe",
    // A cert-bearing key is used throughout, so the strongest mode resolves.
    bindCertificate: "chain",
    // ⚠ `true`, the value that ASKS FOR AN EMISSION — and it has to be, because
    // `false` asks a wire to emit nothing, which the COSE wire already does and
    // therefore `honours`. The deployment default below is flipped to `false` so
    // a `true` reaching the kit can still only have come from here.
    certificateThumbprintSha1: true,
    proprietary: true,
    omit: "undefined",
    partyProducer: "cHJvZHVjZXItcHJvYmU",
    partyRecipient: "cmVjaXBpZW50LXByb2Jl",
  };

  const sentinelOf = (option: string): unknown => {
    const value = SENTINEL[option];

    if (value !== undefined) return value;

    throw new Error(`the probe has no sentinel for the "${option}" option`);
  };

  const WIRES: ReadonlyArray<{ name: string; wire: TokenWire }> = [
    { name: "jose", wire: JOSE_TOKEN_WIRE },
    { name: "cose", wire: COSE_TOKEN_WIRE },
  ];

  /**
   * The three WRITE operations. `decrypt` is absent because its kit option type
   * has no members — there is nothing to forward and nothing to refuse — and the
   * test below fails the day that stops being true, so the omission cannot
   * quietly become a coverage hole.
   */
  type WriteOperation = "signClaims" | "signOpaque" | "encryptContent";

  const OPERATIONS: ReadonlyArray<WriteOperation> = [
    "signClaims",
    "signOpaque",
    "encryptContent",
  ];

  test.each(WIRES)("$name has no decrypt option to dispose of", ({ wire }) => {
    expect(Object.keys(wire.dispositions.decrypt)).toEqual([]);
  });

  /**
   * ⚠ THE THIRD ARM. `consumed` says the WIRE acts on the option ITSELF and does
   * not pass it down, and neither probe below can demonstrate that: the seam
   * probe asserts the kit was handed the value (it never is), and the refusal
   * probe asserts the call throws (it does not). No wire declares one today, and
   * this is what turns that into a stated FACT rather than a gap — the day a
   * table gains a `consumed` row, this goes red and a probe has to be written
   * before it can be relaxed.
   *
   * The two counts beside it guard the `test.each` blocks themselves: a
   * `test.each` over an emptied filter generates NO tests and reports nothing at
   * all, so a renamed `use` value would silently empty both matrices.
   */
  test("every disposition arm is probed below, or provably empty", () => {
    expect(rows((rule) => rule.use === "forwarded").length).toBeGreaterThan(0);
    expect(rows((rule) => rule.use === "unsupported").length).toBeGreaterThan(0);
    expect(
      rows((rule) => rule.use === "consumed").map(
        ({ wire, operation, option }) => `${wire}.${operation}.${option}`,
      ),
      "a consumed row says the wire acts on the option itself — write it a probe, then relax this",
    ).toEqual([]);
  });

  const rows = (
    pick: (rule: Disposition) => boolean,
  ): Array<{
    wire: string;
    operation: WriteOperation;
    option: string;
    rule: Disposition;
  }> =>
    WIRES.flatMap(({ name, wire }) =>
      OPERATIONS.flatMap((operation) =>
        Object.entries(wire.dispositions[operation] as Dict)
          .map(([option, rule]) => ({
            wire: name,
            operation,
            option,
            rule: rule as Disposition,
          }))
          .filter(({ rule }) => pick(rule)),
      ),
    );

  // ---------------------------------------------------------------------------
  // forwarded — driven at the SEAM, asserted on the kit's own call arguments.
  // ---------------------------------------------------------------------------

  describe("a forwarded option ARRIVES at the kit", () => {
    const logger = createMockLogger();

    /** Everything the three write operations read off the bundle. */
    const deps = {
      issuer: "https://test.lindorm.io/",
      certBindingMode: "strict",
      // ⚠ The OPPOSITE of the sentinel — see `SENTINEL.certificateThumbprintSha1`.
      certificateThumbprintSha1: false,
      clockTolerance: 0,
      dpopMaxSkew: 0,
      defaultEncryption: undefined,
      partyRecipient: undefined,
      logger,
      resolveSignKey: async () => TEST_EC_KEY_SIG_CERT,
    } as unknown as AegisDeps;

    /**
     * The options the KIT was handed, for ONE wire operation driven with ONE
     * sentinel. One field at a time on purpose: the COSE kits refuse the same
     * header parameter in both buckets (RFC 9052 §3 — a parameter belongs to one
     * bucket), so a bag carrying every sentinel at once would fail on the header
     * bags rather than on the forward this is about.
     */
    const kitOptionsOf = async (
      wire: string,
      operation: WriteOperation,
      option: string,
    ): Promise<Dict> => {
      const record = wire === "jose" ? JOSE_TOKEN_WIRE : COSE_TOKEN_WIRE;
      const options = { [option]: sentinelOf(option) };

      const spy = (() => {
        switch (`${wire}.${operation}`) {
          case "jose.signClaims":
            return vi.spyOn(JwtKit.prototype, "sign");
          case "jose.signOpaque":
            return vi.spyOn(JwsKit.prototype, "sign");
          case "jose.encryptContent":
            return vi.spyOn(JweKit.prototype, "encrypt");
          case "cose.signClaims":
            return vi.spyOn(CwtKit.prototype, "sign");
          case "cose.signOpaque":
            return vi.spyOn(CwsKit.prototype, "sign");
          case "cose.encryptContent":
            return vi.spyOn(CweKit.prototype, "encrypt");
          default: {
            const exhaustive: never = operation as never;
            throw new Error(`unreachable: ${String(exhaustive)}`);
          }
        }
      })();

      // ⚠ The drive is allowed to THROW, and the catch is not a convenience. What
      // this probe observes is the ARGUMENTS the kit was handed; whether the kit
      // then ACCEPTS them is the kit's own question and the kits' own tests.
      // `unprotected` is where the two come apart: the header registry marks
      // every caller-settable parameter `placement: "protected"`, so on a COSE
      // kit there is no value that both proves the forward and survives the
      // kit's placement rule. A refusal raised BEFORE the kit is called is still
      // caught — by the call-count assertion below, which is what a dropped
      // forward looks like.
      let refusal: unknown;

      try {
        switch (operation) {
          case "signClaims":
            record.signClaims({
              kryptos: TEST_EC_KEY_SIG_CERT,
              deps,
              common: { issuer: deps.issuer as string, subject: "user-1" },
              format: wire === "jose" ? "jwt" : "cwt",
              ...options,
            });
            break;

          case "signOpaque":
            await record.signOpaque({
              deps,
              payload: "probe-payload",
              key: undefined,
              omit: undefined,
              ...options,
            });
            break;

          case "encryptContent":
            record.encryptContent({
              kryptos: wire === "jose" ? TEST_EC_KEY_ENC_CERT : TEST_OCT_KEY_ENC,
              deps,
              content: Buffer.from("probe-plaintext", "utf8"),
              ...options,
            });
            break;

          default: {
            const exhaustive: never = operation;
            throw new Error(`unreachable: ${String(exhaustive)}`);
          }
        }
      } catch (err) {
        refusal = err;
      }

      expect(
        spy,
        refusal === undefined
          ? "the kit was never called"
          : `the kit was never called — the drive threw before reaching it: ${String(refusal)}`,
      ).toHaveBeenCalledTimes(1);

      return (spy.mock.calls[0] as Array<unknown>)[1] as Dict;
    };

    afterEach(() => {
      vi.restoreAllMocks();
    });

    test.each(rows((rule) => rule.use === "forwarded"))(
      "$wire $operation forwards $option",
      async ({ wire, operation, option }) => {
        const received = await kitOptionsOf(wire, operation, option);

        expect(received[option]).toEqual(sentinelOf(option));
      },
    );
  });

  // ---------------------------------------------------------------------------
  // unsupported — driven through the domain verb the guard sits in front of.
  // ---------------------------------------------------------------------------

  describe("an unsupported option is REFUSED, not ignored", () => {
    let aegis: Aegis;

    beforeEach(async () => {
      const logger = createMockLogger();
      const amphora = new Amphora({
        internal: { issuer: "https://test.lindorm.io/" },
        logger,
      });

      aegis = new Aegis({ amphora, logger });

      await amphora.setup();
      amphora.add(TEST_EC_KEY_SIG_CERT);
      amphora.add(TEST_OCT_KEY_ENC);
    });

    /** The domain call that reaches one wire operation, with one option set. */
    const callWith = (
      wire: string,
      operation: WriteOperation,
      option: string,
      value: unknown,
    ): Promise<unknown> => {
      switch (operation) {
        case "signClaims":
          return aegis.mint(
            "id_token",
            { subject: "user-1", audience: ["client-1"] } as never,
            {
              format: wire === "jose" ? "jwt" : "cwt",
              context: { accessTokenIssued: false },
              sign: { [option]: value },
            } as never,
          );

        case "signOpaque":
          return aegis.sign({
            format: wire === "jose" ? "jws" : "cws",
            payload: "probe-payload",
            [option]: value,
          } as never);

        case "encryptContent":
          return aegis.encrypt(
            { subject: "user-1" } as never,
            {
              format: wire === "jose" ? "jwe" : "cwe",
              [option]: value,
            } as never,
          );

        default: {
          const exhaustive: never = operation;
          throw new Error(`unreachable: ${String(exhaustive)}`);
        }
      }
    };

    test.each(rows((rule) => rule.use === "unsupported"))(
      "$wire $operation refuses $option",
      async ({ wire, operation, option }) => {
        await expect(
          callWith(wire, operation, option, sentinelOf(option)),
        ).rejects.toMatchObject({
          code: "wire_option_unsupported",
          data: { operation, option },
        });
      },
    );

    test.each(
      rows(
        (rule) => rule.use === "unsupported" && (rule.honours?.length ?? 0) > 0,
      ).flatMap(({ wire, operation, option, rule }) =>
        (rule.use === "unsupported" ? (rule.honours ?? []) : []).map((honoured) => ({
          wire,
          operation,
          option,
          honoured,
        })),
      ),
    )(
      "$wire $operation accepts $option: $honoured — it asks the wire to do nothing",
      async ({ wire, operation, option, honoured }) => {
        await expect(callWith(wire, operation, option, honoured)).resolves.toBeDefined();
      },
    );
  });
});
