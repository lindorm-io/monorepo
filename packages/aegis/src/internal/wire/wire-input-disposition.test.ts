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
 *   value must be REFUSED.
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
    custom: { protected: { "x-probe": "1.2.3.5" } },
    tokenType: "probe",
    // ⚠ The rule this file applies is DISTINGUISHABILITY FROM THE DEFAULT, not
    // observability on the wire: the probe spies the kit call and asserts the
    // received value, so it never inspects an emitted parameter. `"chain"` is the
    // one mode no deployment default resolves to, which is what makes a received
    // `"chain"` attributable to this sentinel and to nothing else.
    bindCertificate: "chain",
    proprietary: true,
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
   * The three WRITE operations. `decrypt` is absent because it is the READ one:
   * the seam probe below drives each of these through its kit's own SIGN or
   * ENCRYPT method, and a decrypt needs a token to exist first. It gets its own
   * probe further down, so the omission is not a coverage hole.
   */
  type WriteOperation = "signClaims" | "signOpaque" | "encryptContent";

  const OPERATIONS: ReadonlyArray<WriteOperation> = [
    "signClaims",
    "signOpaque",
    "encryptContent",
  ];

  test.each(WIRES)("$name forwards every decrypt option it declares", ({ wire }) => {
    // The read operation's whole table, pinned as the list it is: the seam probe
    // below drives `crit` end to end, and a second decrypt option added without a
    // probe fails here rather than going undriven.
    expect(Object.keys(wire.dispositions.decrypt)).toEqual(["crit"]);
  });

  /** How ONE row reads, for the inventory pin. `reason` is prose and is left out. */
  const describeRule = (rule: Disposition): string => {
    switch (rule.use) {
      case "forwarded":
        return "forwarded";

      case "consumed":
        return `consumed by ${rule.by}`;

      case "unsupported":
        return "unsupported";

      default: {
        // `noImplicitReturns` is off repo-wide. Without this a new arm would
        // describe as `undefined` and the inventory would pin nothing about it.
        const exhaustive: never = rule;
        throw new Error(`unhandled disposition: ${JSON.stringify(exhaustive)}`);
      }
    }
  };

  /**
   * ⭐ THE INVENTORY, pinned as DATA OUTSIDE the generated matrices.
   *
   * Every `wire.operation.option -> use` triple. The matrices below are GENERATED
   * from this same data, so they cannot notice it changing: a row whose `use`
   * flips moves from one matrix to the other and both stay green. Only a pin
   * outside the generation can see that.
   *
   * ⚠ Iterates `Object.keys(wire.dispositions)`, NOT the hand-written OPERATIONS
   * list, so a fourth write operation appears here rather than going unprobed.
   */
  test("the wire input disposition inventory", () => {
    const inventory = WIRES.flatMap(({ name, wire }) =>
      Object.keys(wire.dispositions).flatMap((operation) =>
        Object.entries(
          wire.dispositions[operation as keyof WireInputDispositions] as Dict,
        ).map(
          ([option, rule]) =>
            `${name}.${operation}.${option} -> ${describeRule(rule as Disposition)}`,
        ),
      ),
    ).sort();

    // ⚠ A HARD COUNT beside the snapshot, deliberately NOT snapshotted: `vitest -u`
    // rewrites a snapshot without anyone reading the diff, and this repo's own
    // notes record `-u` doing exactly that. A plain assertion cannot be updated
    // by `-u`, so a row that disappears has to be answered for by hand.
    expect(inventory).toHaveLength(36);
    expect(inventory).toMatchSnapshot();
  });

  /**
   * The hand-written {@link OPERATIONS} list is TOTAL over the write operations
   * the tables declare.
   *
   * `WireInputDispositions` is a hand-written type and the `never` default in the
   * probes below is exhaustive over the hand-written `WriteOperation` union, not
   * over `keyof WireInputDispositions` — so a FOURTH write operation would
   * typecheck, ship, and never be driven by either matrix. This is what notices.
   */
  test.each(WIRES)(
    "$name declares exactly OPERATIONS plus the read operation",
    ({ wire }) => {
      expect(Object.keys(wire.dispositions).sort()).toEqual(
        [...OPERATIONS, "decrypt"].sort(),
      );
    },
  );

  /**
   * ⚠ THE THIRD ARM. `consumed` says the WIRE acts on the option ITSELF and does
   * not pass it down, and neither probe below can demonstrate that: the seam
   * probe asserts the kit was handed the value (it never is), and the refusal
   * probe asserts the call throws (it does not). No wire declares one today, and
   * this is what turns that into a stated FACT rather than a gap — the day a
   * table gains a `consumed` row, this goes red and a probe has to be written
   * before it can be relaxed.
   *
   * ⚠ The two counts beside it are EXACT, and they are what SIZES each matrix.
   * They were `> 0` — enough to catch an emptied filter, nothing else — and the
   * inventory snapshot above does not replace them: `toHaveLength(40)` guards
   * ARITY, so flipping every `unsupported` row to `forwarded` keeps the count at
   * 40, empties the refusal matrix, and one `vitest -u` rewrites the snapshot
   * unread and makes it green. A plain `toBe` cannot be updated by `-u`, which is
   * the whole reason the hard count sits beside the snapshot rather than in it.
   *
   * ⚠ These count the WRITE operations alone, because {@link rows} iterates
   * {@link OPERATIONS}. 32 + 2 = 34, and the inventory's other two rows are the
   * two wires' `decrypt.crit`, driven by the decrypt probe below. The two refusals
   * are the COSE ECDH-ES party-info rows on `encryptContent`: RFC 9052 §5.2 makes
   * a COSE_Encrypt0 direct encryption, so no key agreement happens for RFC 7518
   * §4.6's party info to feed.
   */
  test("every disposition arm is probed below, or provably empty", () => {
    expect(
      rows((rule) => rule.use === "forwarded").length,
      "the forwarded matrix changed size — say why, then update this",
    ).toBe(32);
    expect(
      rows((rule) => rule.use === "unsupported").length,
      "the refusal matrix changed size — say why, then update this",
    ).toBe(2);
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

    /**
     * The READ operation's own seam probe. It cannot join the matrix above — that
     * one drives a kit's SIGN or ENCRYPT method, and a decrypt needs a token
     * first — so the artifact is produced through the same wire's
     * `encryptContent` and then read back through its `decrypt`.
     *
     * ⚠ Without it `decrypt.crit` would be a `forwarded` row nothing drives, and
     * the declaration is what makes a custom critical parameter readable at all
     * (`internal/utils/reject-unknown-critical.ts`) — a dropped forward turns a
     * token aegis just minted into one it refuses.
     */
    test.each(WIRES)("$name decrypt forwards crit", async ({ name, wire }) => {
      const kryptos = name === "jose" ? TEST_EC_KEY_ENC_CERT : TEST_OCT_KEY_ENC;

      const spy =
        name === "jose"
          ? vi.spyOn(JweKit.prototype, "decrypt")
          : vi.spyOn(CweKit.prototype, "decrypt");

      const token = await wire.encryptContent({
        kryptos,
        deps: { ...deps, resolveDecryptKey: async () => kryptos } as AegisDeps,
        content: Buffer.from("probe-plaintext", "utf8"),
      });

      await wire.decrypt({
        token,
        deps: { ...deps, resolveDecryptKey: async () => kryptos } as AegisDeps,
        key: undefined,
        crit: ["x-probe"],
      });

      expect(spy).toHaveBeenCalledTimes(1);
      expect((spy.mock.calls[0] as Array<unknown>)[1]).toEqual({ crit: ["x-probe"] });
    });
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
          // The opaque KIT namespaces. They now reach `wire.signOpaque` through
          // the shared guard (`raw-sign-opaque.ts`) instead of calling their
          // wire's signer directly, which is what puts this operation back
          // within reach of a public door.
          return wire === "jose"
            ? aegis.jws.sign("probe-payload", { [option]: value } as never)
            : aegis.cws.sign("probe-payload", { [option]: value } as never);

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
  });
});
