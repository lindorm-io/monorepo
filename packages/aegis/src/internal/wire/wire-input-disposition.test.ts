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
import type { CoseWireTokenEnvelope, JoseWireTokenEnvelope } from "../../types/index.js";
import type { Wire } from "../registry/wire.js";
import type { AegisDeps } from "../utils/aegis-deps.js";
import { COSE_TOKEN_WIRE } from "./cose-token-wire.js";
import { JOSE_TOKEN_WIRE } from "./jose-token-wire.js";
import type { TokenWire, WireInputDispositions } from "./token-wire.js";
import type { Disposition } from "./wire-input-disposition.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

/**
 * THE PROOF that the disposition tables are not merely a claim — both halves are
 * RUN rather than read.
 *
 * - `forwarded` — driven AT THE SEAM, kit method spied, each field required to
 *   have ARRIVED with the caller's own value. Below the domain verbs on purpose:
 *   `unprotected`, and `proprietary` on the opaque sign path, have no domain door
 *   for a probe to reach them through.
 * - `unsupported` — driven through the REAL domain verb, because the guard runs
 *   above the seam and only a caller can trip it.
 *
 * ⛔ Delete a field from a wire's forward and this goes red.
 */
describe("wire input dispositions", () => {
  /**
   * One TEST-OWNED value per kit option, distinguishable from anything the
   * production code would default to. ⛔ Never read from the source's own
   * constants — a sentinel that agrees with the default proves nothing.
   */
  const SENTINEL: Dict = {
    header: { oid: "1.2.3.4" },
    tokenType: "probe",
    // ⚠ The rule is DISTINGUISHABILITY FROM THE DEFAULT, not observability on the
    // wire — the probe spies the kit call. `"chain"` is the one mode no deployment
    // default resolves to, so a received `"chain"` is attributable to this alone.
    bindCertificate: "chain",
    proprietary: true,
    partyProducer: "cHJvZHVjZXItcHJvYmU",
    partyRecipient: "cmVjaXBpZW50LXByb2Jl",
  };

  /**
   * The one sentinel whose SHAPE is per-wire: JOSE names its single custom bucket
   * `header`, COSE has `protected`/`unprotected` (`types/header/wire-envelope.ts`).
   *
   * ⚠ THE PER-WIRE TYPES ARE THE ASSERTION. Forwarding is a rest-spread and so
   * SHAPE-BLIND — the probe asserts only that the bag ARRIVED, and passes just as
   * green when the JOSE arm states the COSE spelling. Only the excess-property
   * check on these two literals refuses that.
   */
  const CUSTOM_SENTINEL: {
    jose: JoseWireTokenEnvelope["custom"];
    cose: CoseWireTokenEnvelope["custom"];
  } = {
    jose: { header: { "x-probe": "1.2.3.5" } },
    cose: { protected: { "x-probe": "1.2.3.5" } },
  };

  const sentinelOf = (wire: Wire, option: string): unknown => {
    const value = option === "custom" ? CUSTOM_SENTINEL[wire] : SENTINEL[option];

    if (value !== undefined) return value;

    throw new Error(
      `the probe has no sentinel for the "${option}" option on the ${wire} wire`,
    );
  };

  const WIRES: ReadonlyArray<{ name: Wire; wire: TokenWire }> = [
    { name: "jose", wire: JOSE_TOKEN_WIRE },
    { name: "cose", wire: COSE_TOKEN_WIRE },
  ];

  /**
   * The three WRITE operations. `decrypt` is the READ one and needs a token to
   * exist first, so it gets its own probe further down rather than a row here.
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
   * ⭐ THE INVENTORY, pinned as DATA OUTSIDE the generated matrices. A row whose
   * `use` flips moves from one generated matrix to the other and both stay green;
   * only a pin outside the generation sees it.
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
    // rewrites a snapshot unread, and a plain assertion it cannot rewrite is what
    // makes a disappearing row get answered for by hand.
    expect(inventory).toHaveLength(36);
    expect(inventory).toMatchSnapshot();
  });

  /**
   * The hand-written {@link OPERATIONS} list is TOTAL over the write operations the
   * tables declare. The `never` defaults below are exhaustive over the hand-written
   * `WriteOperation` union, not over `keyof WireInputDispositions`, so a FOURTH
   * write operation would typecheck and go undriven. This is what notices.
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
   * ⚠ THE THIRD ARM. `consumed` says the WIRE acts on the option itself and passes
   * nothing down, which neither probe below can demonstrate — the seam probe
   * asserts the kit was handed the value, the refusal probe asserts a throw. No
   * wire declares one, so the day a table gains one this goes red and a probe has
   * to be written before it can be relaxed.
   *
   * ⚠ The counts are EXACT and are what SIZES each matrix. An arity-only guard
   * would stay green while every `unsupported` row flipped to `forwarded` and
   * emptied the refusal matrix; a plain `toBe` is also the one thing `vitest -u`
   * cannot rewrite.
   *
   * ⚠ They count the WRITE operations alone, because {@link rows} iterates
   * {@link OPERATIONS}; the inventory's remaining rows are the two wires'
   * `decrypt.crit`. The two refusals are the COSE ECDH-ES party-info rows on
   * `encryptContent` — a COSE_Encrypt0 runs no key-agreement step for the party
   * info to describe (RFC 9052 §5.2, RFC 7518 §4.6).
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
    wire: Wire;
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
     * sentinel. One field at a time: the COSE kits refuse the same header parameter
     * in both buckets (RFC 9052 §3), so a bag carrying every sentinel at once would
     * fail on the header bags rather than on the forward this is about.
     */
    const kitOptionsOf = async (
      wire: Wire,
      operation: WriteOperation,
      option: string,
    ): Promise<Dict> => {
      const record = wire === "jose" ? JOSE_TOKEN_WIRE : COSE_TOKEN_WIRE;
      const options = { [option]: sentinelOf(wire, option) };

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

      // ⚠ The drive is allowed to THROW, and the catch is not a convenience: this
      // probe observes the ARGUMENTS the kit was handed, not whether the kit accepts
      // them. `unprotected` is where the two come apart — the header registry marks
      // every caller-settable parameter `placement: "protected"`. A refusal raised
      // BEFORE the kit is called is still caught by the call-count assertion below.
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

        expect(received[option]).toEqual(sentinelOf(wire, option));
      },
    );

    /**
     * The READ operation's own seam probe: the artifact is produced through the
     * same wire's `encryptContent` and read back through its `decrypt`.
     *
     * ⚠ Without it `decrypt.crit` would be a `forwarded` row nothing drives, and
     * that forward is what makes a custom critical parameter readable at all
     * (`internal/utils/reject-unknown-critical.ts`).
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
      wire: Wire,
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
          // The opaque KIT namespaces reach `wire.signOpaque` through the shared
          // guard (`raw-sign-opaque.ts`), which is what puts this operation within
          // reach of a public door.
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
          callWith(wire, operation, option, sentinelOf(wire, option)),
        ).rejects.toMatchObject({
          code: "wire_option_unsupported",
          data: { operation, option },
        });
      },
    );
  });
});
