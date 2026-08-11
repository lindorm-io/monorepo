import type { VerifyOptions } from "../../types/index.js";

/**
 * How one `VerifyOptions` field behaves across the two wires.
 *
 * `default` is ALWAYS a `{ jose, cose }` pair, even where the two agree. The
 * verbosity IS the mechanism: a scalar shorthand would let a new option be added
 * with one value and no thought given to the second wire, which is exactly how
 * the current divergences arrived.
 */
export type ParityCase<T> =
  | {
      /** Read on both wires — the target state for every row. */
      wires: "both";
      default: { jose: T; cose: T };
      /** Required when the two defaults differ; cite the RFCs that force it. */
      reason?: string;
      /**
       * Set while the row is NOT yet true of the code. Names the wire that drops
       * the option and the finding behind it. The parity suite skips a row that
       * carries one, so deleting the field is what turns its test on.
       */
      bug?: string;
    }
  | {
      /** Read on ONE wire only. Never a threading accident — state why. */
      wires: "jose" | "cose";
      default: { jose: T; cose: T };
      reason: string;
      bug?: string;
    };

/**
 * `-?` strips optionality, so the table literal must supply EVERY key: adding a
 * field to `VerifyOptions` fails to compile here until it has a row.
 */
export type VerifyOptionParity = {
  [K in keyof VerifyOptions]-?: ParityCase<VerifyOptions[K]>;
};

/**
 * Per-option WIRE PARITY for `VerifyOptions` — the one place recording which
 * wires read each verify knob and what it resolves to when the caller says
 * nothing.
 *
 * Why it exists: the option surface is threaded BY HAND at four claims-verify
 * sites, each re-deriving which of the thirteen fields it forwards. A dropped
 * option is accepted and ignored rather than rejected, so the drift is invisible
 * to both the compiler and the caller. This table makes the contract a value:
 * `satisfies VerifyOptionParity` binds it to the type in both directions, and
 * the parity suite drives its probes off the rows.
 *
 * Ordered as `VerifyOptions` declares them.
 */
export const VERIFY_OPTION_PARITY = {
  actor: {
    wires: "both",
    default: { jose: undefined, cose: undefined },
    bug: "cose: buildCoseVerifiedToken never extracts the act chain, so validateActor is never reached (F5)",
  },

  clockTolerance: {
    wires: "both",
    default: { jose: undefined, cose: undefined },
  },

  currentDate: {
    wires: "both",
    default: { jose: undefined, cose: undefined },
  },

  maxTokenAge: {
    wires: "both",
    default: { jose: undefined, cose: undefined },
  },

  verifyExpiration: {
    wires: "both",
    default: { jose: true, cose: true },
  },

  verifyNotBefore: {
    wires: "both",
    default: { jose: true, cose: true },
  },

  verifyIssuedAt: {
    wires: "both",
    default: { jose: true, cose: true },
  },

  verifyAuthTime: {
    wires: "both",
    default: { jose: true, cose: true },
  },

  dpopProof: {
    wires: "both",
    default: { jose: undefined, cose: undefined },
    reason:
      "RFC 9449 defines only the JWT proof form, but the PROOF's wire is independent of the bound token's: a cnf.jkt in a CWT binds exactly as it does in a JWT",
    bug: "cose: no DPoP check on any COSE claims path",
  },

  trustBoundThumbprint: {
    wires: "both",
    default: { jose: false, cose: false },
    bug: "cose: the bound-but-unproven refusal it waives is not made on COSE, so the waiver has nothing to waive",
  },

  key: {
    wires: "both",
    default: { jose: undefined, cose: undefined },
    bug: "cose: coseVerifyCore takes no key parameter, so the claims path resolves unscoped by kid alone — the opaque CWS branch does thread it",
  },

  typPresence: {
    wires: "both",
    default: { jose: "required", cose: "optional" },
    reason:
      "RFC 8725 §3.11 mandates explicit typing for JOSE; RFC 9596 leaves the COSE typ (label 16) optional. An explicit value behaves identically on both wires — only the unstated default follows each RFC",
    bug: "cose: typ presence is not checked at all, so the option is neither honoured nor defaulted",
  },

  expPresence: {
    wires: "both",
    default: { jose: "required", cose: "required" },
  },
} satisfies VerifyOptionParity;

/**
 * The `VerifyOptions` key set, DERIVED from the parity table rather than listed
 * beside it — the table is `satisfies VerifyOptionParity`, so its keys are
 * exactly `keyof VerifyOptions` and the assertion below is sound.
 *
 * Public because a consumer splitting a flat matcher-and-knob bag has to know
 * which keys are knobs, and a hand-copied list drifts: pylon's copy misrouted
 * `tokenType`/`accessToken`/`authCode`/`authState` after they moved to
 * `DomainAssert`, and misrouted `clockTolerance` the other way.
 */
export const VERIFY_OPTION_KEYS = Object.keys(VERIFY_OPTION_PARITY) as ReadonlyArray<
  keyof VerifyOptions
>;
