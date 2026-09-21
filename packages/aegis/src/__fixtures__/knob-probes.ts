import type { Dict } from "@lindorm/types";
import type { Wire } from "../internal/registry/wire.js";
import type {
  EncryptData,
  EncryptOptions,
  JoseSignStructuredTokenOptions,
  ProfileContent,
  ProfileMintOptions,
  SignContext,
  SignTokenOptions,
  TokenFormatTag,
  VerifyOptions,
} from "../types/index.js";
import type { MintEncryptOptions } from "../types/profile/profile.js";
import {
  TEST_EC_KEY_ENC_CERT,
  TEST_EC_KEY_SIG,
  TEST_EC_KEY_SIG_CERT,
  TEST_OCT_KEY_ENC,
  TEST_OCT_KEY_ENC_CBC,
  TEST_OCT_KEY_ENC_GCM128,
  TEST_OKP_KEY_SIG,
} from "./keys.js";
import type { WireKey } from "./raw-bucket.js";
import { CLIENT, ISSUER, NOW, RESOURCE } from "./test-deployment.js";
import { TEST_X509_CHAIN_B64 } from "./x509.js";

/**
 * The KNOB PROBES — pure DATA, no behaviour, one table per option bag.
 *
 * A feature scenario states a CAPABILITY. A probe states something narrower and
 * differently motivated: that ONE OPTION IS READ. It exists because an option
 * this package accepts and drops fails silently in both directions — the
 * compiler cannot see a named field left out of a hand-written forward, and the
 * caller cannot see it either, because a dropped knob does not raise, it just
 * does nothing. Every claims-verify and every write path threads its option bag
 * BY HAND, so the drift has somewhere to happen at each of them.
 *
 * ⚠ A PROBE DEMONSTRATES, IT NEVER DECLARES. Each one is run TWICE per wire —
 * once with the knob unset and once set to `value` — and the two runs must
 * DISAGREE. That is the entire mechanism: an option that has been dropped makes
 * the two runs agree, so the probe goes red. A probe that merely asserted the
 * current behaviour with the knob set would stay green over a forward that never
 * reads it.
 *
 * Two forms, and a probe is exactly one of them:
 *
 * - a VERDICT probe (`baseline`/`flipped`) — the knob decides whether the act is
 *   accepted at all. Every verify knob is one of these.
 * - an ARTIFACT probe (`format`/`observed`) — the knob changes the token that
 *   comes out. The artifact is built WITHOUT the knob and the observation must
 *   FAIL, then WITH it and the observation must HOLD.
 *
 * Two DECLARATION fields, and they are NOT interchangeable:
 *
 * - {@link KnobProbeCore.unobservable} — the flip cannot be observed on that
 *   wire for a SPECIFICATION or SERIALISATION reason, verified against the
 *   primary text. Permanent: no repair to aegis would make it observable.
 * - {@link KnobProbeCore.defect} — the option is accepted and DROPPED by today's
 *   code. Transient, and a real finding: it names the `file:line` that fails to
 *   read it, and it is deleted when the forward is repaired.
 *
 * ⚠ Every value here is JSON-serialisable (a table test enforces it): these
 * tables are meant to be readable by something that is not TypeScript. A `Date` therefore appears as a {@link DateCell}, the
 * one value shape the interpreter revives — every option bag bottoms out in
 * `Dict`, so a live `Date` would compile and then be silently stringified.
 */

/** The two verdicts an act can reach. */
export type Verdict = "accepts" | "rejects";

/** The probe-side spelling of an option's own type — `Date` becomes a {@link DateCell}. */
export type ProbeValue<T> = T extends Date ? DateCell : T;

/**
 * A `Date`, as DATA — the one value the option and claim bags carry that JSON
 * has no literal for. Revived recursively over the whole probe, so a cell is
 * written wherever a `Date` belongs. Narrow on purpose: a lone `date` member
 * holding a string.
 */
export type DateCell = { readonly date: string };

/** The vault residents a probe may stock beyond the signing key every deployment holds. */
export type KeyFixture =
  | "ec-enc"
  | "ec-enc-cert"
  | "ec-sig-cert"
  | "oct-enc"
  | "oct-enc-cbc"
  | "oct-enc-gcm128"
  | "oct-sig"
  | "okp-sig";

export type KeysGivenStep = { step: "keys"; keys: ReadonlyArray<KeyFixture> };

/**
 * The claims-bearing raw door on the run's wire — `aegis.jwt.sign` on JOSE,
 * `aegis.cwt.sign` on COSE — over claims and an envelope stated in the JOSE
 * vocabulary; the interpreter re-spells both for COSE.
 */
export type KitSignGivenStep = {
  step: "token";
  via: "kit-sign";
  kit: "structured";
  claims: Dict;
  options?: JoseSignStructuredTokenOptions;
};

/** A claims token a third party signs over the deployment's signing key, stamping no type header. */
export type ForeignGivenStep = { step: "token"; via: "foreign"; claims: Dict };

/**
 * `aegis.mint(profile, content, options)`, one member per built-in profile so
 * `profile` and `content` are correlated. A `format` the probe states pins the
 * artifact; otherwise the run's wire picks `jwt` or `cwt`.
 */
export type MintGivenStep = {
  [P in keyof ProfileContent]: {
    step: "token";
    via: "mint";
    profile: P;
    content: ProfileContent[P];
    options?: ProfileMintOptions;
  };
}[keyof ProfileContent];

/** `aegis.encrypt(data, options)`; the run's wire picks `jwe` or `cwe` unless the probe states a `format`. */
export type DomainEncryptGivenStep = {
  step: "token";
  via: "domain-encrypt";
  data: EncryptData;
  options?: EncryptOptions;
};

export type ArtifactGivenStep =
  | KitSignGivenStep
  | ForeignGivenStep
  | MintGivenStep
  | DomainEncryptGivenStep;

/** Any number of vault steps, then the artifact — the tuple makes exactly one artifact, last. */
export type Given = readonly [...ReadonlyArray<KeysGivenStep>, ArtifactGivenStep];

/**
 * What a probe asserts about one raw wire bucket, read off the bytes by the
 * independent inspector. `includes` compares VALUES against the raw decoded ones
 * — a byte-string parameter never equals the text it spells, so assert its
 * `present` instead; `present` and `excludes` ask about keys alone. At least
 * one of the three, so a step cannot name a bucket and check nothing.
 */
export type WireAssertion =
  | {
      includes: Dict;
      present?: ReadonlyArray<WireKey>;
      excludes?: ReadonlyArray<WireKey>;
    }
  | {
      includes?: Dict;
      present: ReadonlyArray<WireKey>;
      excludes?: ReadonlyArray<WireKey>;
    }
  | {
      includes?: Dict;
      present?: ReadonlyArray<WireKey>;
      excludes: ReadonlyArray<WireKey>;
    };

/**
 * One observation over the artifact's protected header or its claims. `on`
 * scopes it to the wire whose SPELLING it states; absent, it holds on every wire
 * the probe runs on.
 */
export type ObservationStep = WireAssertion & {
  step: "wireProtectedHeader" | "wireClaims";
  on?: Wire;
};

/** A format tag, bare when it holds on every wire the probe runs on, else stated per wire. */
export type FormatTag = TokenFormatTag | Partial<Record<Wire, TokenFormatTag>>;

/**
 * A defect: the option reaches the call and is then not read.
 *
 * `site` is `file#anchor`, where the anchor is a VERBATIM substring of the cited
 * line — the exact forward that omits it, so the repair has a destination, and
 * the meta suite resolves it rather than trusting a line number that code motion
 * silently invalidates. `wires` narrows the drop to the wires it happens on; a
 * knob read on one wire and dropped on the other keeps its coverage on the wire
 * that works, which an all-or-nothing skip would throw away.
 */
export type KnobDefect = {
  site: string;
  note: string;
  wires?: ReadonlyArray<Wire>;
};

type VerdictBody = {
  baseline: Verdict;
  flipped: Verdict;
  format?: never;
  wrapper?: never;
  observed?: never;
};

type ArtifactBody = {
  baseline?: never;
  flipped?: never;
  /** The artifact FORMAT the knob produces, when the format is what it changes. */
  format?: FormatTag;
  /**
   * The artifact WRAPPER the knob produces, when the ENVELOPE is what it changes.
   *
   * ⚠ A knob that wraps a token does NOT change its `format`: a signed token
   * keeps its own kind inside an envelope, so `encrypt` is observable here and
   * not above.
   */
  wrapper?: FormatTag;
  /** Everything else the knob changes about the artifact. */
  observed: ReadonlyArray<ObservationStep>;
};

type ProbeBody<T> = { value: ProbeValue<T> } & (VerdictBody | ArtifactBody);

type KnobProbeCore<T> = {
  /**
   * WHY the option must be read — the specification requirement or the security
   * property a caller loses when it is dropped. Durable: it reads as true whether
   * or not the forward currently honours it, which is what makes it survive the
   * repair of a {@link defect}.
   */
  rationale: string;
  /** The vault residents to stock, then the artifact the knob is probed on. */
  given: Given;
  /**
   * The wires the flip cannot be stated on, and WHY — a SPECIFICATION or
   * SERIALISATION fact, cited to the primary text and permanent. Never "no probe
   * written yet", and never a shortfall in the code: that is {@link defect}.
   */
  unobservable?: Readonly<Partial<Record<Wire, string>>>;
  defect?: KnobDefect;
  /**
   * The wires whose flip is stated DIFFERENTLY — a different value, a different
   * verdict, a different observation.
   *
   * It exists for the knobs whose DEFAULT differs between the wires, where one
   * statement cannot cover both: `typPresence` defaults to `"required"` on JOSE
   * and `"optional"` on COSE, so the value that flips a verdict on one wire is
   * the value that changes nothing on the other. The override REPLACES the value
   * and the outcome for that wire; it is still the same rule, stated per wire.
   */
  overrides?: Readonly<Partial<Record<Wire, ProbeBody<T>>>>;
};

export type KnobProbe<T> = KnobProbeCore<T> & ProbeBody<T>;

/** A probe table: TOTAL over its bag, so a new option fails to compile until it has one. */
export type KnobProbes<B> = { [K in keyof B]-?: KnobProbe<NonNullable<B[K]>> };

// ---------------------------------------------------------------------------
// Shared literals
// ---------------------------------------------------------------------------

/** A claims set that verifies cleanly at `NOW`. */
const LIVE_CLAIMS: Dict = {
  iss: ISSUER,
  sub: "user-1",
  aud: [RESOURCE],
  exp: NOW + 3600,
  iat: NOW,
  jti: "token-1",
};

/**
 * A base64url value standing in for a hash claim. The COSE claim codec decodes
 * `at_hash`/`c_hash`/`s_hash` from base64url to bytes, so a hash claim that is
 * not base64url fails to ENCODE on that wire — the probe would then measure the
 * encoder rather than the forward.
 */
const HASH = "3q2-7w";

/** A real 32-byte base64url thumbprint (`Buffer.alloc(32, 7)`) — the COSE encoder refuses a short one. */
const JKT = "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc";

/** The id_token content every mint probe starts from. */
const ID_TOKEN_CONTENT = { subject: "user-1", audience: [CLIENT] };

// ---------------------------------------------------------------------------
// VerifyOptions
// ---------------------------------------------------------------------------

/**
 * Every verify knob, on every wire. The bag is threaded by hand at each
 * claims-verify site, and three of these were measured to be droppable from the
 * COSE forward with the whole suite still green.
 */
export const VERIFY_KNOB_PROBES = {
  actor: {
    rationale:
      "A dropped `actor` turns a stated constraint into no constraint: the caller believes the delegation chain in `act` is being checked and therefore stops checking it. RFC 8693 §4.1.",
    value: { required: true },
    given: [{ step: "token", via: "kit-sign", kit: "structured", claims: LIVE_CLAIMS }],
    baseline: "accepts",
    flipped: "rejects",
  },

  clockTolerance: {
    rationale:
      "The skew allowance is the deployment's to choose, so a verifier that states one and has it dropped refuses tokens whose `exp` or `nbf` fall inside the leeway it asked for. RFC 7519 §4.1.4, RFC 7519 §4.1.5.",
    value: 60,
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: { ...LIVE_CLAIMS, exp: NOW - 30 },
      },
    ],
    baseline: "rejects",
    flipped: "accepts",
  },

  currentDate: {
    rationale:
      "Every temporal check is a comparison against an instant, and the instant is an INPUT: a verifier replaying a stored token, or testing one, states the instant it means. Dropping it silently substitutes the wall clock, so the answer is about a different moment than the one the caller asked about — and it is the wrong answer in the permissive direction as readily as the strict one.",
    value: { date: "2024-01-01T06:30:00.000Z" },
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: { ...LIVE_CLAIMS, exp: NOW - 3600, iat: NOW - 7200 },
      },
    ],
    baseline: "rejects",
    flipped: "accepts",
  },

  critical: {
    rationale:
      "aegis is never the final recipient — it verifies on the application's behalf — so declaring an extension header parameter is the application taking responsibility for understanding it. Dropping the declaration refuses a token the caller has accepted responsibility for. RFC 7515 §4.1.11.",
    value: ["x-lindorm-hint"],
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: LIVE_CLAIMS,
        options: {
          header: { crit: ["x-lindorm-hint"] },
          custom: { header: { "x-lindorm-hint": "carried" } },
        },
      },
    ],
    baseline: "rejects",
    flipped: "accepts",
  },

  maxTokenAge: {
    rationale:
      "A TIGHTENING option — it can only refuse tokens that would otherwise pass — so dropping it is always the unsafe direction, and it leaves no trace: a stale token verifying looks exactly like a fresh one. OIDC Core §3.1.2.1, OIDC Core §3.1.3.7.",
    value: 60,
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: { ...LIVE_CLAIMS, iat: NOW - 7200 },
      },
    ],
    baseline: "accepts",
    flipped: "rejects",
  },

  verifyExpiration: {
    rationale:
      "Waiving the `exp` RANGE check is a narrow, deliberate request — an `id_token_hint` is presented after its lifetime and the OP still accepts it — and a flag that is accepted and ignored means a caller who asked for the waiver silently does not get it. OIDC Core §3.1.2.1, OIDC Core §3.1.2.2.",
    value: false,
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: { ...LIVE_CLAIMS, exp: NOW - 3600, iat: NOW - 7200 },
      },
    ],
    baseline: "rejects",
    flipped: "accepts",
  },

  verifyNotBefore: {
    rationale:
      "Waiving the `nbf` lower bound is a deliberate act with a narrow purpose, and a flag that is accepted and ignored means a caller who asked for the waiver silently does not get it. RFC 7519 §4.1.5.",
    value: false,
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: { ...LIVE_CLAIMS, nbf: NOW + 3600, exp: NOW + 7200 },
      },
    ],
    baseline: "rejects",
    flipped: "accepts",
  },

  verifyIssuedAt: {
    rationale:
      "aegis bounds `iat` so a token stamped in the future is refused. The flag waives that bound and nothing else — `maxTokenAge` keeps its own — so it has to be read independently of the other temporal flags rather than folded into them. RFC 7519 §4.1.6.",
    value: false,
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: { ...LIVE_CLAIMS, iat: NOW + 3600, exp: NOW + 7200 },
      },
    ],
    baseline: "rejects",
    flipped: "accepts",
  },

  verifyAuthTime: {
    rationale:
      "aegis range-checks `auth_time` like every other temporal claim. The waiver exists so the four temporal claims are individually controllable; a flag that only works for three of them is a surface that lies about its own shape. OIDC Core §2.",
    value: false,
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: { ...LIVE_CLAIMS, auth_time: NOW + 3600 },
      },
    ],
    baseline: "rejects",
    flipped: "accepts",
  },

  dpopProof: {
    rationale:
      "Supplying a proof is an assertion about the token — that it IS bound — so a proof presented for a token carrying no binding is a mismatch aegis refuses rather than shrugs at. A dropped proof option means the whole possession check never runs, and a bearer token is accepted where a bound one was demanded. RFC 9449 §7.1.",
    value: "not-a-dpop-proof",
    given: [{ step: "token", via: "kit-sign", kit: "structured", claims: LIVE_CLAIMS }],
    baseline: "accepts",
    flipped: "rejects",
  },

  trustBoundThumbprint: {
    rationale:
      "A token carrying a `cnf` thumbprint is bound (RFC 9449 §6.1), and the default refusal of a bound token presented without a proof is what makes the binding worth anything. The waiver exists for a verifier that established possession OUT OF BAND — a socket that proved it at handshake — and it is the only way to say so. Dropped, the deployment cannot verify its own tokens at all.",
    value: true,
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: { ...LIVE_CLAIMS, cnf: { jkt: JKT } },
      },
    ],
    baseline: "rejects",
    flipped: "accepts",
    unobservable: {
      cose: "The waiver applies to a token bound by a JWK thumbprint, and aegis gives `jkt` no COSE label at all (`src/internal/claims/cnf-members.ts#const NO_COSE_JKT`). There is no JWK thumbprint in a CWT for this option to waive. RFC 9449 §6.1, RFC 9679 §5.5.",
    },
  },

  key: {
    rationale:
      "A key selector is how the caller states the set of keys and algorithms it will accept, and it is a CHECK applied before the signature is touched. Dropped, the token's own header decides which vault resident verifies it. RFC 8725 §3.1.",
    value: { condition: { algorithm: "RS256" } },
    given: [{ step: "token", via: "kit-sign", kit: "structured", claims: LIVE_CLAIMS }],
    baseline: "accepts",
    flipped: "rejects",
  },

  typPresence: {
    rationale:
      "Presence is a POLICY, not a fact about the token: a conformant foreign token may carry no `typ`, and a verifier states whether it will accept that. The two wires default the policy differently, so the value that flips the verdict on one is the value that changes nothing on the other — which is why the flip is stated per wire here. RFC 8725 §3.11, RFC 7519 §5.1, RFC 9596 §2.",
    value: "optional",
    given: [{ step: "token", via: "foreign", claims: LIVE_CLAIMS }],
    baseline: "rejects",
    flipped: "accepts",
    overrides: {
      cose: { value: "required", baseline: "accepts", flipped: "rejects" },
    },
  },

  expPresence: {
    rationale:
      "Presence is a per-call policy: a conformant security event token normally carries no `exp`, while an access token with no expiry never stops working. A dropped policy either refuses every conformant SET or accepts an unbounded access token, depending on which way the default falls. RFC 8417 §2.2.",
    value: "optional",
    given: [
      {
        step: "token",
        via: "kit-sign",
        kit: "structured",
        claims: { iss: ISSUER, sub: "user-1", aud: [RESOURCE], iat: NOW, jti: "token-1" },
      },
    ],
    baseline: "rejects",
    flipped: "accepts",
  },
} satisfies KnobProbes<VerifyOptions>;

// ---------------------------------------------------------------------------
// ProfileMintOptions
// ---------------------------------------------------------------------------

/** The profiled mint surface — `aegis.mint(profile, content, options)`. */
export const MINT_KNOB_PROBES = {
  sign: {
    rationale:
      "The signing envelope is where a caller states everything about the inner token that the profile does not: its header bag, its own key, the hash claims it carries. It is one object, so dropping it drops all of them at once — and a header parameter that never reaches the wire is invisible to the caller, because nothing rejects an option that simply does not arrive.",
    value: { header: { objectId: "1.2.3.4" } },
    given: [
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: ID_TOKEN_CONTENT,
        options: { context: { accessTokenIssued: false } },
      },
    ],
    observed: [
      { step: "wireProtectedHeader", on: "jose", includes: { oid: "1.2.3.4" } },
      // ⚠ The TEXT label `oid`, not the integer -70000: with `proprietary` unset
      // aegis writes the interoperable string label, and `proprietary: true` is
      // what writes the lindorm private-use integer. `excludes` states the two
      // apart, since the record compares stringified keys. RFC 8152 §16.2,
      // RFC 9052 §1.5.
      {
        step: "wireProtectedHeader",
        on: "cose",
        includes: { oid: "1.2.3.4" },
        excludes: [-70000],
      },
    ],
  },

  encrypt: {
    rationale:
      "Presence of the encrypt envelope is what turns sign-then-encrypt ON — it is not a modifier of an encryption that was happening anyway. A dropped envelope therefore does not merely lose an option: it emits the token in CLEARTEXT to a caller who asked for it to be sealed to a recipient.",
    value: {},
    given: [
      { step: "keys", keys: ["oct-enc"] },
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: ID_TOKEN_CONTENT,
        options: { context: { accessTokenIssued: false } },
      },
    ],
    // The knob WRAPS the token; it does not change what the token is. An
    // encrypted id_token is still an id_token — `format` is identical with the
    // knob set and unset, which is why the observable effect is the wrapper.
    wrapper: { jose: "jwe", cose: "cwe" },
    observed: [],
  },

  lifetime: {
    rationale:
      "The profile's lifetime is a default, and a per-call override is how a deployment issues the short-lived token a particular grant calls for. Dropped, every token silently gets the profile default instead — longer, in the only direction that matters, and with nothing on the wire to say the request was ignored.",
    value: "7 minutes",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: ID_TOKEN_CONTENT,
        options: { context: { accessTokenIssued: false } },
      },
    ],
    observed: [
      { step: "wireClaims", on: "jose", includes: { exp: NOW + 420 } },
      { step: "wireClaims", on: "cose", includes: { "4": NOW + 420 } },
    ],
  },

  context: {
    rationale:
      "A context-reading policy rule asks about a fact only the issuer has — whether an access token co-issued alongside this one. The enforcer refuses to evaluate such a rule without it, and that refusal IS the mechanism: an absent context and a context stating `false` must not look the same, or a caller who simply forgot mints the token the rule exists to prevent.",
    value: { accessTokenIssued: false },
    given: [
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: ID_TOKEN_CONTENT,
      },
    ],
    baseline: "rejects",
    flipped: "accepts",
  },

  format: {
    rationale:
      "The wire encoder is the caller's choice, and it is the one mint option whose effect is the ARTIFACT'S KIND rather than its contents. A dropped format emits a signed structure of a different kind than the one asked for — a COSE_Sign1 where a COSE_Mac0 was requested — which a recipient expecting the requested kind cannot read at all.",
    value: "cwm",
    given: [
      { step: "keys", keys: ["oct-sig"] },
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: ID_TOKEN_CONTENT,
        options: {
          context: { accessTokenIssued: false },
          // A COSE_Mac0 REQUIRES a symmetric key and a COSE_Sign1 refuses one, so
          // the baseline states its own format rather than inheriting the run's
          // wire: the wire-derived `cwt` baseline could not be built with the key
          // this knob's value needs.
          format: "jwt",
          sign: { key: { condition: { algClass: "symmetric" } } },
        },
      },
    ],
    format: "cwm",
    observed: [],
  },

  proprietary: {
    rationale:
      "A platform token keyed by the compact private-use labels is smaller; an off-platform one must not be, because no foreign reader can resolve a private label. The knob is the only way to say which is being minted, so dropping it emits an uninteroperable token to an external party. RFC 8392 §1.1.",
    value: true,
    given: [
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: {
          ...ID_TOKEN_CONTENT,
          authTime: { date: "2024-01-01T07:30:00.000Z" } as never,
        },
        options: { context: { accessTokenIssued: false } },
      },
    ],
    observed: [
      { step: "wireClaims", on: "cose", present: [-65541], excludes: ["auth_time"] },
    ],
    unobservable: {
      jose: "The compact form this knob selects is an INTEGER map key, and a JOSE claims set is a JSON object whose member names are strings. There is no JOSE encoding for the thing being switched on. RFC 7519 §4, RFC 8392 §1.1.",
    },
  },
} satisfies KnobProbes<ProfileMintOptions>;

// ---------------------------------------------------------------------------
// ProfileMintOptions["sign"] — SignTokenOptions
// ---------------------------------------------------------------------------

/** The signing envelope's own leaves, each threaded separately into the wire. */
export const MINT_SIGN_KNOB_PROBES = {
  accessTokenHash: {
    rationale:
      "`at_hash` is what ties the id_token to the co-issued access token. Dropped, the id_token makes no statement about the access token at all and the binding a relying party checks simply is not there. OIDC Core §3.1.3.6.",
    value: HASH,
    given: [
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: ID_TOKEN_CONTENT,
        // `accessTokenIssued: false`, not `true`: the profile requires `at_hash`
        // whenever an access token co-issues, so a `true` baseline could not
        // build the knob-less token this probe has to compare against.
        options: { context: { accessTokenIssued: false } },
      },
    ],
    observed: [
      { step: "wireClaims", on: "jose", includes: { at_hash: HASH } },
      { step: "wireClaims", on: "cose", present: ["at_hash"] },
    ],
  },

  codeHash: {
    rationale:
      "`c_hash` is the only thing binding an id_token to the code delivered beside it. Without it a code substituted in transit is indistinguishable from the one the id_token was issued for. OIDC Core §3.3.2.11.",
    value: HASH,
    given: [
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: ID_TOKEN_CONTENT,
        options: { context: { accessTokenIssued: false } },
      },
    ],
    observed: [
      { step: "wireClaims", on: "jose", includes: { c_hash: HASH } },
      { step: "wireClaims", on: "cose", present: ["c_hash"] },
    ],
  },

  issuedAt: {
    rationale:
      "An issuer that backdates or replays a token states its `iat` explicitly. Dropped, the token claims to have been issued at the moment of encoding — a false statement about provenance that defeats every freshness bound computed from it. RFC 7519 §4.1.6.",
    value: { date: "2024-01-01T07:00:00.000Z" },
    given: [
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: ID_TOKEN_CONTENT,
        options: { context: { accessTokenIssued: false } },
      },
    ],
    observed: [
      { step: "wireClaims", on: "jose", includes: { iat: NOW - 3600 } },
      { step: "wireClaims", on: "cose", includes: { "6": NOW - 3600 } },
    ],
  },

  stateHash: {
    rationale:
      "`s_hash` is a FAPI claim, not an OIDC Core one, and it is what lets a client detect a response grafted onto a different request. A dropped hash claim removes the attestation while leaving the client believing it was made. FAPI 1.0 Part 2 §5.1.1, FAPI 1.0 Part 2 §5.2.2.1, FAPI 1.0 Part 2 §5.2.3.1.",
    value: HASH,
    given: [
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: ID_TOKEN_CONTENT,
        options: { context: { accessTokenIssued: false } },
      },
    ],
    observed: [
      { step: "wireClaims", on: "jose", includes: { s_hash: HASH } },
      { step: "wireClaims", on: "cose", present: ["s_hash"] },
    ],
  },

  tokenId: {
    rationale:
      "An issuer that must correlate the token with something it already stored supplies its own `jti`. Dropped, the stored identifier and the token's identifier are different values, so every lookup against it misses. RFC 7519 §4.1.7.",
    value: "explicit-token-id",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: ID_TOKEN_CONTENT,
        options: { context: { accessTokenIssued: false } },
      },
    ],
    observed: [
      { step: "wireClaims", on: "jose", includes: { jti: "explicit-token-id" } },
      // The CWT `cti` is a byte string, so its VALUE never equals the text it
      // spells — presence is the assertion available here. RFC 8392 §3.1.7.
      { step: "wireClaims", on: "cose", present: [7] },
    ],
  },

  typ: {
    rationale:
      "A profile that mandates no type of its own leaves the choice to the caller — an issuer emitting an application-specific artifact says what it is. Dropped, the token carries the bare conventional type instead, which is the ambiguity explicit typing exists to remove. RFC 8725 §3.11.",
    value: "application/custom+jwt",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "jarm",
        content: { audience: [CLIENT] },
      },
    ],
    // Both wires, because the defect below is declared on COSE and a JOSE-only
    // observation would hold vacuously on the wire the shortfall is claimed on.
    // The COSE spelling is the caller's media type with the wire's own
    // structured suffix — `+jwt` becomes `+cwt`, the same translation `coseTyp`
    // applies to a profile's own typ. RFC 9596 §2.
    observed: [
      {
        step: "wireProtectedHeader",
        on: "jose",
        includes: { typ: "application/custom+jwt" },
      },
      {
        step: "wireProtectedHeader",
        on: "cose",
        includes: { "16": "application/custom+cwt" },
      },
    ],
  },

  bindCertificate: {
    rationale:
      "A certificate-bound token names the certificate that may present it, and the binding mode decides whether the thumbprint alone travels or the whole chain does. A relying party that cannot build a path to a trust anchor cannot validate the binding, so an issuer asked for the chain and given a thumbprint has issued a token nobody can check.",
    value: "chain",
    given: [
      { step: "keys", keys: ["ec-sig-cert"] },
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: ID_TOKEN_CONTENT,
        options: {
          context: { accessTokenIssued: false },
          sign: { key: { condition: { id: TEST_EC_KEY_SIG_CERT.id } } },
        },
      },
    ],
    // The chain is representable on BOTH wires, so the COSE side is observed
    // too rather than declared unobservable. RFC 9360 §2.
    observed: [
      // JOSE asserts the CONTENTS, not merely the presence — a truncated,
      // reversed or PEM-armoured chain is still an `x5c`, and it is one no
      // relying party can build a path from. RFC 7515 §4.1.6.
      { step: "wireProtectedHeader", on: "jose", includes: { x5c: TEST_X509_CHAIN_B64 } },
      // ⚠ COSE asserts PRESENCE ONLY here: the value is a `COSE_X509` of raw DER
      // byte strings, which this step compares as stringified record values and
      // cannot state faithfully. What this row holds is that the knob REACHES the
      // COSE writer; the bytes themselves are asserted by the independent wire
      // inspector at
      // `src/classes/cose-cert-binding.test.ts#The DER bytes themselves, against the fixture, in order`.
      // RFC 9360 §2.
      { step: "wireProtectedHeader", on: "cose", present: [33] },
    ],
  },

  header: {
    rationale:
      "The protected header bag is the caller's only way to put an application parameter under the signature. A parameter that never reaches the wire is not merely missing — it is missing from the INTEGRITY-PROTECTED bucket, so a reader that requires it sees a token that never made the statement.",
    value: { objectId: "1.2.3.4" },
    given: [
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: ID_TOKEN_CONTENT,
        options: { context: { accessTokenIssued: false } },
      },
    ],
    observed: [
      { step: "wireProtectedHeader", on: "jose", includes: { oid: "1.2.3.4" } },
      // ⚠ The TEXT label `oid`, not the integer -70000: with `proprietary` unset
      // aegis writes the interoperable string label, and `proprietary: true` is
      // what writes the lindorm private-use integer. `excludes` states the two
      // apart, since the record compares stringified keys. RFC 8152 §16.2,
      // RFC 9052 §1.5.
      {
        step: "wireProtectedHeader",
        on: "cose",
        includes: { oid: "1.2.3.4" },
        excludes: [-70000],
      },
    ],
  },

  key: {
    rationale:
      "Which key signs the token decides who can verify it and what the signature proves. A deployment pinning a key — a per-client algorithm, a specific `kid` — has made a statement its recipients depend on, and a dropped selector silently signs with whatever the vault returns first instead.",
    value: { condition: { id: TEST_OKP_KEY_SIG.id } },
    given: [
      { step: "keys", keys: ["okp-sig"] },
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: ID_TOKEN_CONTENT,
        options: {
          context: { accessTokenIssued: false },
          // The baseline PINS its own key. With two signing residents in the
          // vault an unpinned baseline resolves whichever the query returns
          // first, which is a coin toss the probe would then measure.
          sign: { key: { condition: { id: TEST_EC_KEY_SIG.id } } },
        },
      },
    ],
    observed: [
      { step: "wireProtectedHeader", on: "jose", includes: { alg: "EdDSA" } },
      // The two keys declare different COSE algorithms — -8 for the EdDSA key
      // this knob names, -36 for the pinned ES512 baseline — so the resolved key
      // is legible from the protected bucket. RFC 9053 §2.2.
      { step: "wireProtectedHeader", on: "cose", includes: { "1": -8 } },
    ],
  },
} satisfies KnobProbes<SignTokenOptions>;

// ---------------------------------------------------------------------------
// ProfileMintOptions["encrypt"]
// ---------------------------------------------------------------------------

/**
 * The sign-then-encrypt wrapper's own leaves. The GIVEN already carries an empty
 * `encrypt` bag, because its PRESENCE is what turns encryption on — without it a
 * probe would be measuring encryption appearing rather than the leaf being read.
 */
export const MINT_ENCRYPT_KNOB_PROBES = {
  header: {
    rationale:
      "The encrypting outer's protected header is integrity-protected by the AEAD, so a parameter placed there is a statement a recipient can rely on before decrypting. A caller that states one and does not get it has an outer that says less than it believes.",
    value: { oid: "1.2.3.4" },
    given: [
      { step: "keys", keys: ["oct-enc"] },
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: ID_TOKEN_CONTENT,
        options: { context: { accessTokenIssued: false }, encrypt: {} },
      },
    ],
    observed: [
      { step: "wireProtectedHeader", on: "jose", includes: { oid: "1.2.3.4" } },
      // ⚠ The TEXT label `oid`, not the integer -70000: with `proprietary` unset
      // aegis writes the interoperable string label, and `proprietary: true` is
      // what writes the lindorm private-use integer. `excludes` states the two
      // apart, since the record compares stringified keys. RFC 8152 §16.2,
      // RFC 9052 §1.5.
      {
        step: "wireProtectedHeader",
        on: "cose",
        includes: { oid: "1.2.3.4" },
        excludes: [-70000],
      },
    ],
  },

  tokenType: {
    rationale:
      "The encrypting outer declares its own type so a recipient can route it before holding the key to open it. A caller stating one for the outer is describing the envelope, not the inner token, and dropping it leaves the outer typed by the inner profile — a different statement about a different object.",
    value: "custom",
    given: [
      { step: "keys", keys: ["oct-enc"] },
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: ID_TOKEN_CONTENT,
        options: { context: { accessTokenIssued: false }, encrypt: {} },
      },
    ],
    observed: [
      {
        step: "wireProtectedHeader",
        on: "jose",
        includes: { typ: "application/custom+jwe" },
      },
      {
        step: "wireProtectedHeader",
        on: "cose",
        includes: { "16": "application/custom+cwe" },
      },
    ],
  },

  bindCertificate: {
    rationale:
      "Binding the encrypting outer to a certificate is how a recipient confirms it is the party the ciphertext was written to. The mode decides whether a thumbprint or the whole chain travels, and a recipient with no path to an anchor cannot complete the check.",
    value: "chain",
    given: [
      { step: "keys", keys: ["ec-enc-cert"] },
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: ID_TOKEN_CONTENT,
        options: {
          context: { accessTokenIssued: false },
          encrypt: { key: { condition: { id: TEST_EC_KEY_ENC_CERT.id } } },
        },
      },
    ],
    observed: [{ step: "wireProtectedHeader", on: "jose", present: ["x5c"] }],
    unobservable: {
      cose: "A COSE_Encrypt0 has no certificate to bind. It carries no recipients array, so aegis requires the recipient key to BE the content-encryption key — a kryptos `dir` key — and a symmetric key carries no X.509 certificate for a thumbprint or a chain to be derived from. The parameters themselves are representable; what cannot exist on this wire is a cert-bearing recipient. RFC 9052 §5.2, RFC 9360 §2.",
    },
  },

  proprietary: {
    rationale:
      "The interop gate decides whether a private-use COSE content encryption may be emitted at all. Stated on the encrypt envelope it is a statement about the OUTER specifically — a deployment may seal on-platform with a private-use cipher while the inner token stays interoperable — so it cannot be inferred from the mint-level flag.",
    value: true,
    given: [
      { step: "keys", keys: ["oct-enc-cbc"] },
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: ID_TOKEN_CONTENT,
        options: {
          context: { accessTokenIssued: false },
          encrypt: { key: { condition: { id: TEST_OCT_KEY_ENC_CBC.id } } },
        },
      },
    ],
    baseline: "rejects",
    flipped: "accepts",
    unobservable: {
      jose: "There is no gate to open. AES-CBC-HMAC is a standard JOSE `enc` value, so that wire is interoperable either way; on COSE aegis has to emit it under a lindorm private-use label (`src/internal/cose/enc-labels.ts#const ENC_TO_COSE_PRIVATE`), which is what gives this knob something to decide. RFC 7518 §5.2.3, RFC 9053 §4.",
    },
  },

  partyProducer: {
    rationale:
      "`apu` is an input to the ECDH-ES key derivation as well as a header parameter: producer and recipient must agree on it or the ciphertext does not open. A dropped `apu` does not merely omit a header — it derives a different key than the recipient expects. RFC 7518 §4.6.1.2.",
    value: "cHJvZHVjZXI",
    given: [
      { step: "keys", keys: ["ec-enc"] },
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: ID_TOKEN_CONTENT,
        options: { context: { accessTokenIssued: false }, encrypt: {} },
      },
    ],
    observed: [{ step: "wireProtectedHeader", on: "jose", present: ["apu"] }],
    unobservable: {
      cose: "aegis's COSE outer is a COSE_Encrypt0. It carries no recipients array and runs no recipient algorithm, so there is no key-agreement step for `apu` to feed. RFC 7518 §4.6, RFC 9052 §5.2.",
    },
  },

  partyRecipient: {
    rationale:
      "`apv` is the recipient half of the same key derivation, and aegis's read side compares the incoming value against the one it was configured with. It is a key-derivation input and an assertion about who the ciphertext was written to at once; dropping it removes both. RFC 7518 §4.6.1.3.",
    value: "cmVjaXBpZW50",
    given: [
      { step: "keys", keys: ["ec-enc"] },
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: ID_TOKEN_CONTENT,
        options: { context: { accessTokenIssued: false }, encrypt: {} },
      },
    ],
    observed: [{ step: "wireProtectedHeader", on: "jose", present: ["apv"] }],
    unobservable: {
      cose: "Shares `partyProducer`'s reason exactly: aegis's COSE_Encrypt0 outer runs no recipient algorithm, so there is no key agreement for `apv` to feed. RFC 7518 §4.6, RFC 9052 §5.2.",
    },
  },

  key: {
    rationale:
      "The recipient key IS the addressee: it decides who can open the token. A dropped selector seals the token to whatever the vault returns first, which is the one mistake in this family that cannot be detected by the intended recipient — they simply cannot decrypt, and the token looks well-formed to everyone else.",
    value: { condition: { id: TEST_OCT_KEY_ENC_GCM128.id } },
    given: [
      { step: "keys", keys: ["oct-enc", "oct-enc-gcm128"] },
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: ID_TOKEN_CONTENT,
        options: {
          context: { accessTokenIssued: false },
          encrypt: { key: { condition: { id: TEST_OCT_KEY_ENC.id } } },
        },
      },
    ],
    // The resolved key is legible from the CONTENT ENCRYPTION it declares, on
    // both wires. The recipient `kid` is not — it rides the unprotected bucket
    // as a byte string, which no literal here can equal. RFC 9052 §3.1.
    observed: [
      { step: "wireProtectedHeader", on: "jose", includes: { enc: "A128GCM" } },
      { step: "wireProtectedHeader", on: "cose", includes: { "1": 1 } },
    ],
  },
} satisfies KnobProbes<MintEncryptOptions>;

// ---------------------------------------------------------------------------
// ProfileMintOptions["context"] — SignContext
// ---------------------------------------------------------------------------

/** The mint-time facts a policy rule may read. Closed, and each one is enforced. */
export const MINT_CONTEXT_KNOB_PROBES = {
  accessTokenIssued: {
    rationale:
      "aegis requires `at_hash` whenever an access token co-issues — a fact only the issuer holds. The enforcer refuses to evaluate the rule without it precisely because an unsupplied fact and a `false` one are indistinguishable from inside, and the unsupplied case is the one that must not mint. OIDC Core §3.1.3.6.",
    value: false,
    given: [
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: ID_TOKEN_CONTENT,
        options: { context: {} },
      },
    ],
    baseline: "rejects",
    flipped: "accepts",
  },
} satisfies KnobProbes<SignContext>;

// ---------------------------------------------------------------------------
// EncryptOptions
// ---------------------------------------------------------------------------

/** The domain confidentiality verb — `aegis.encrypt(data, options)`. */
export const ENCRYPT_KNOB_PROBES = {
  bindCertificate: {
    rationale:
      "Binding the ciphertext to a certificate tells the recipient which certificate the content was written for, and the mode decides whether the chain travels with it. A recipient that cannot build a path to an anchor cannot complete the check the binding exists for.",
    value: "chain",
    given: [
      { step: "keys", keys: ["ec-enc-cert"] },
      {
        step: "token",
        via: "domain-encrypt",
        data: { subject: "user-1" },
        options: { key: { condition: { id: TEST_EC_KEY_ENC_CERT.id } } },
      },
    ],
    observed: [{ step: "wireProtectedHeader", on: "jose", present: ["x5c"] }],
    unobservable: {
      cose: "A COSE_Encrypt0 has no certificate to bind. It carries no recipients array, so aegis requires the recipient key to BE the content-encryption key — a kryptos `dir` key — and a symmetric key carries no X.509 certificate for a thumbprint or a chain to be derived from. The parameters themselves are representable; what cannot exist on this wire is a cert-bearing recipient. RFC 9052 §5.2, RFC 9360 §2.",
    },
  },

  header: {
    rationale:
      "The protected header of an encrypted token is covered by the AEAD, so a parameter placed there is a statement a recipient can trust before decrypting. A caller that states one and does not get it holds a token that makes a weaker claim than it believes.",
    value: { objectId: "1.2.3.4" },
    given: [
      { step: "keys", keys: ["oct-enc"] },
      { step: "token", via: "domain-encrypt", data: { subject: "user-1" } },
    ],
    observed: [
      { step: "wireProtectedHeader", on: "jose", includes: { oid: "1.2.3.4" } },
      // ⚠ The TEXT label `oid`, not the integer -70000: with `proprietary` unset
      // aegis writes the interoperable string label, and `proprietary: true` is
      // what writes the lindorm private-use integer. `excludes` states the two
      // apart, since the record compares stringified keys. RFC 8152 §16.2,
      // RFC 9052 §1.5.
      {
        step: "wireProtectedHeader",
        on: "cose",
        includes: { oid: "1.2.3.4" },
        excludes: [-70000],
      },
    ],
  },

  key: {
    rationale:
      "The recipient key IS the addressee. A dropped selector seals the content to whatever the vault returns first, and the failure is invisible to everyone except the intended recipient — who simply cannot open it.",
    value: { condition: { id: TEST_OCT_KEY_ENC_GCM128.id } },
    given: [
      { step: "keys", keys: ["oct-enc", "oct-enc-gcm128"] },
      {
        step: "token",
        via: "domain-encrypt",
        data: { subject: "user-1" },
        options: { key: { condition: { id: TEST_OCT_KEY_ENC.id } } },
      },
    ],
    // See the mint twin: the content encryption is the resolved key's only
    // property legible from the protected bucket on both wires.
    observed: [
      { step: "wireProtectedHeader", on: "jose", includes: { enc: "A128GCM" } },
      { step: "wireProtectedHeader", on: "cose", includes: { "1": 1 } },
    ],
  },

  format: {
    rationale:
      "The encoder is the caller's choice and it decides the ARTIFACT'S KIND: a JWE and a COSE_Encrypt0 are different structures that different recipients can read. A dropped format hands back something the addressee cannot parse at all. It is the one knob whose value names a wire, so the value that changes the outcome is necessarily the other wire's — which is why it is stated per wire here.",
    value: "cwe",
    given: [
      { step: "keys", keys: ["oct-enc"] },
      { step: "token", via: "domain-encrypt", data: { subject: "user-1" } },
    ],
    format: "cwe",
    observed: [],
    overrides: {
      cose: { value: "jwe", format: "jwe", observed: [] },
    },
  },

  type: {
    rationale:
      "The type header declares what the encrypted object IS, so a recipient can route it before holding the key to open it. Dropped, every encrypted artifact carries the bare conventional type and an application that dispatches on it cannot tell two kinds apart.",
    value: "access_token",
    given: [
      { step: "keys", keys: ["oct-enc"] },
      { step: "token", via: "domain-encrypt", data: "opaque-payload" },
    ],
    observed: [
      {
        step: "wireProtectedHeader",
        on: "jose",
        includes: { typ: "application/at+jwe" },
      },
      {
        step: "wireProtectedHeader",
        on: "cose",
        includes: { "16": "application/at+cwe" },
      },
    ],
  },

  partyProducer: {
    rationale:
      "`apu` feeds the ECDH-ES key derivation as well as being emitted, so producer and recipient must agree on the value or the derived content key differs. Dropping it does not omit a header — it derives a different key than the recipient will. RFC 7518 §4.6.1.2.",
    value: "cHJvZHVjZXI",
    given: [
      { step: "keys", keys: ["ec-enc"] },
      { step: "token", via: "domain-encrypt", data: { subject: "user-1" } },
    ],
    observed: [{ step: "wireProtectedHeader", on: "jose", present: ["apu"] }],
    unobservable: {
      cose: "aegis's `cwe` is a COSE_Encrypt0. It carries no recipients array and runs no recipient algorithm, so there is no key agreement and no PartyUInfo for `apu` to supply. RFC 7518 §4.6, RFC 9052 §5.2.",
    },
  },

  partyRecipient: {
    rationale:
      "`apv` is the recipient half of the same derivation, and a decrypt configured with one checks the incoming value against it. It is a key-derivation input and an assertion about the addressee at once; a dropped one loses both. RFC 7518 §4.6.1.3.",
    value: "cmVjaXBpZW50",
    given: [
      { step: "keys", keys: ["ec-enc"] },
      { step: "token", via: "domain-encrypt", data: { subject: "user-1" } },
    ],
    observed: [{ step: "wireProtectedHeader", on: "jose", present: ["apv"] }],
    unobservable: {
      cose: "Shares `partyProducer`'s reason: aegis's COSE_Encrypt0 runs no recipient algorithm, so there is no key agreement for `apv` to feed. RFC 7518 §4.6, RFC 9052 §5.2.",
    },
  },

  proprietary: {
    rationale:
      "The interop gate decides whether a private-use COSE content encryption may be emitted. Off, a token sealed with one would be unreadable by every conformant COSE implementation, so the refusal is the point: a caller must state that it accepts an on-platform-only artifact before one is produced.",
    value: true,
    given: [
      { step: "keys", keys: ["oct-enc-cbc"] },
      {
        step: "token",
        via: "domain-encrypt",
        data: "opaque-payload",
        options: { key: { condition: { id: TEST_OCT_KEY_ENC_CBC.id } } },
      },
    ],
    baseline: "rejects",
    flipped: "accepts",
    unobservable: {
      jose: "There is no gate to open. AES-CBC-HMAC is a standard JOSE `enc` value, so that wire is interoperable either way; on COSE aegis has to emit it under a lindorm private-use label (`src/internal/cose/enc-labels.ts#const ENC_TO_COSE_PRIVATE`), which is what gives this knob something to decide. RFC 7518 §5.2.3, RFC 9053 §4.",
    },
  },
} satisfies KnobProbes<EncryptOptions>;
