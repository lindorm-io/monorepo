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
      /**
       * Required when the two defaults differ — `Aegis.knob-matrix.test.ts`
       * asserts it. Reference bare.
       */
      reason?: string;
    }
  | {
      /** Read on ONE wire only. Never a threading accident — state why. */
      wires: "jose" | "cose";
      default: { jose: T; cose: T };
      reason: string;
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
 * `satisfies VerifyOptionParity` binds it to the type in both directions.
 *
 * ⚠ It RECORDS the contract; it does not demonstrate it. What each option
 * actually does on each wire is proved by RUNNING it — see the knob matrix
 * (`classes/Aegis.knob-matrix.test.ts`), which drives one probe per option off
 * the same key set and requires the two runs to disagree.
 *
 * Ordered as `VerifyOptions` declares them.
 */
export const VERIFY_OPTION_PARITY = {
  actor: {
    wires: "both",
    default: { jose: undefined, cose: undefined },
  },

  clockTolerance: {
    wires: "both",
    default: { jose: undefined, cose: undefined },
  },

  currentDate: {
    wires: "both",
    default: { jose: undefined, cose: undefined },
  },

  critical: {
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
      "aegis reads a DPoP proof as a compact JWS on either wire, because the PROOF's wire is independent of the bound token's — a proof presented for a CWT that carries no binding is a mismatch refused there exactly as on JOSE, which is what the knob probe observes on COSE. ⚠ It is the BOUND-token case the option exists for that has no COSE instance: aegis's COSE confirmation carries an embedded COSE_Key and a kid only, and it will not relabel a JWK thumbprint as the COSE one, which digests different bytes. RFC 9449 §4.2, RFC 8747 §3.1, RFC 9679 §5.5",
  },

  trustBoundThumbprint: {
    wires: "both",
    default: { jose: false, cose: false },
    reason:
      "It waives the refusal of a token that IS bound and was presented without a proof, so on COSE there is no state for it to act on: aegis gives a JWK thumbprint no COSE label and will not relabel it as the COSE thumbprint, which digests different bytes, so the probe declares it unobservable there. ⚠ NOT dpopProof's reason — that option is read AND observed on both wires. RFC 9679 §5.5",
  },

  key: {
    wires: "both",
    default: { jose: undefined, cose: undefined },
  },

  typPresence: {
    wires: "both",
    default: { jose: "required", cose: "optional" },
    reason:
      "Requiring a typ on JOSE is aegis POLICY; aegis leaves the COSE typ (label 16) optional. An explicit value behaves identically on both wires — only the unstated default differs. ⚠ The required case is unobservable on COSE today: every COSE writer stamps a typ (a bare CWT gets application/cwt), so a typ-less CWT cannot be produced to reject. RFC 8725 §3.11, RFC 9596 §2",
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
