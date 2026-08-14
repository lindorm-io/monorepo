import type { Dict } from "@lindorm/types";
import { TEST_X509_CHAIN_B64 } from "./x509.js";
import type {
  EncryptOptions,
  ProfileMintOptions,
  SignContext,
  SignTokenOptions,
  VerifyOptions,
} from "../types/index.js";
import type { JweEncryptOptions } from "../types/kit/encrypted.js";
import type { AegisEncKey } from "../types/keys/key-selectors.js";
import {
  CERT_ENC_KEY_ID,
  CERT_SIG_KEY_ID,
  CLIENT,
  EC_ENC_KEY_ID,
  ISSUER,
  JKT,
  NOW,
  OCT_ENC_CBC_KEY_ID,
  OCT_ENC_KEY_ID,
  OCT_ENC_GCM128_KEY_ID,
  OKP_SIG_KEY_ID,
  RESOURCE,
  SIG_KEY_ID,
  type AcceptsThenStep,
  type DateCell,
  type Given,
  type ObservationThenStep,
  type Wire,
} from "./scenarios.js";

/**
 * The KNOB PROBES — pure DATA, no behaviour, one table per option bag.
 *
 * A conformance row states a CAPABILITY. A probe states something narrower and
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
 * ⚠ Every value here is JSON-serialisable, for the same reason a scenario row is
 * (a table test enforces it): these tables are meant to be readable by something
 * that is not TypeScript. A `Date` therefore appears as a {@link DateCell}, the
 * one value shape the interpreter revives — every option bag bottoms out in
 * `Dict`, so a live `Date` would compile and then be silently stringified.
 */

/** The two verdicts an act can reach. */
export type Verdict = "accepts" | "rejects";

/** The probe-side spelling of an option's own type — `Date` becomes a {@link DateCell}. */
export type ProbeValue<T> = T extends Date ? DateCell : T;

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

/** The act performed on the artifact before an observation is made. */
export type ProbeAct = { step: "parse" } | { step: "decrypt" };

type VerdictBody = {
  baseline: Verdict;
  flipped: Verdict;
  format?: never;
  observed?: never;
};

type ArtifactBody = {
  baseline?: never;
  flipped?: never;
  /** The artifact FORMAT the knob produces, when the format is what it changes. */
  format?: AcceptsThenStep["format"];
  /** Everything else the knob changes about the artifact. */
  observed: ReadonlyArray<ObservationThenStep>;
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
  given: Given;
  /** Only where the knob's effect is invisible without a further read. */
  act?: ProbeAct;
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

/** A claims set that verifies cleanly at the table's default clock. */
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
      "A token that has been delegated says so in its `act` claim (RFC 8693 §4.1), and a verifier's whole reason to state an actor policy is that it will not accept an unconstrained chain. A dropped `actor` turns a stated constraint into no constraint, which is the failure mode a policy option must never have: the caller believes the chain is being checked and therefore stops checking it.",
    value: { required: true },
    given: [{ step: "token", via: "kit-sign", kit: "structured", claims: LIVE_CLAIMS }],
    baseline: "accepts",
    flipped: "rejects",
  },

  clockTolerance: {
    rationale:
      "RFC 7519 §4.1.4 provides for 'some small leeway, usually no more than a few minutes, to account for clock skew' when checking `exp`, and §4.1.5 says the same of `nbf`. The leeway is the deployment's to choose, so a verifier that states one and has it dropped rejects tokens that are valid by the specification's own allowance.",
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

  maxTokenAge: {
    rationale:
      "OIDC Core §3.1.2.1 gives a relying party `max_age`, and §3.1.3.7 requires it to check the authentication's freshness on the way back; the same shape of bound applies to a token's own `iat`. It is a TIGHTENING option — it can only refuse tokens that would otherwise pass — so dropping it is always the unsafe direction, and it leaves no trace because a stale token verifying looks exactly like a fresh one.",
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
      "OIDC Core §3.1.2.1 defines `id_token_hint` as an 'ID Token previously issued by the Authorization Server being passed as a hint about the End-User's current or past authenticated session with the Client', and §3.1.2.2 says the OP 'SHOULD accept ID Tokens when the RP identified by the ID Token has a current session or had a recent session at the OP, even when the exp time has passed' — the signature is what is being trusted there, not the lifetime, while the same paragraph keeps the issuer check mandatory. Waiving the `exp` RANGE check is therefore a legitimate, narrow request, and one that must be honoured exactly: dropped, the hint flow cannot work at all.",
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
      "RFC 7519 §4.1.5 makes `nbf` a hard lower bound — 'the JWT MUST NOT be accepted for processing' before it. Waiving that bound is a deliberate act with a narrow purpose, and a flag that is accepted and ignored means a caller who asked for the waiver silently does not get it.",
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
      "RFC 7519 §4.1.6 defines `iat` as when the token was issued, and a verifier bounds it so a token stamped in the future is refused. The flag waives that bound and nothing else — `maxTokenAge` keeps its own — so it has to be read independently of the other temporal flags rather than folded into them.",
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
      "OIDC Core §2 defines `auth_time` as the instant the end-user authentication occurred, and it is range-checked like every other temporal claim. The waiver exists so that the four temporal claims are individually controllable; a flag that only works for three of them is a surface that lies about its own shape.",
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
      "RFC 9449 §7.1 has the resource server check that the presented proof matches the access token's binding. Supplying a proof is therefore an assertion about the token — that it IS bound — and a proof presented for a token carrying no binding is a mismatch the verifier must refuse rather than shrug at. A dropped proof option means the whole possession check never runs, and a bearer token is accepted where a bound one was demanded.",
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
      cose: "The waiver applies to a token that IS bound by a JWK thumbprint, and no CWT can be. RFC 9449 §6.1 defines `jkt` as a JWT Confirmation Method member — 'When access tokens are represented as JWTs, the public key information is represented using the jkt confirmation method member defined herein' — and RFC 9679 §5.5 declines to register \"a CWT confirmation method [RFC8747] for using 'jkt' as a confirmation method for a CWT\". The COSE wire's own thumbprint confirmation, `ckt` (RFC 9679 §5.6), digests the key's canonical CBOR rather than the canonical JSON RFC 7638 digests, so it is a different value under a different label and not a spelling of `jkt`. There is no JWK thumbprint to put in a CWT, so the state this option waives cannot be reached on that wire.",
    },
  },

  key: {
    rationale:
      "RFC 8725 §3.1 puts the restriction in the caller's hands and makes honouring it mandatory: 'Libraries MUST enable the caller to specify a supported set of algorithms and MUST NOT use any other algorithms when performing cryptographic operations.' A key selector is how that set is stated here, and it is a CHECK applied before the signature is touched — so a dropped one means the token's own header decides which vault resident verifies it, which is the state the requirement exists to prevent.",
    value: { condition: { algorithm: "RS256" } },
    given: [{ step: "token", via: "kit-sign", kit: "structured", claims: LIVE_CLAIMS }],
    baseline: "accepts",
    flipped: "rejects",
  },

  typPresence: {
    rationale:
      "RFC 8725 §3.11 recommends explicit typing so a token of one kind cannot be replayed where another is expected. Presence is a POLICY, not a fact about the token: `typ` is OPTIONAL on both wires (RFC 7519 §5.1, RFC 9596 §2), so a conformant foreign token may carry none, and a verifier states whether it will accept that. The two wires default the policy differently, so the value that flips the verdict on one is the value that changes nothing on the other — which is exactly why the flip is stated per wire here.",
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
      "RFC 8417 §2.2 says of `exp` in a security event token that 'In the context of a SET, however, this notion does not typically apply, since a SET represents something that has already occurred and is historical in nature. Therefore, its use is NOT RECOMMENDED' — so a conformant SET normally carries none, while an ordinary access token with no expiry is a token that never stops working. Presence is therefore a per-call policy, and a dropped one either refuses every conformant SET or accepts an unbounded access token, depending on which way the default falls.",
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
      // ⚠ The TEXT label `oid`, not the integer -70000. `oid` has no IANA COSE
      // parameter, so it rides a lindorm PRIVATE-USE label — RFC 8152 §16.2,
      // "Integer values less than -65536 are marked as private use" — which a
      // foreign reader cannot interpret. The interoperable default (`proprietary`
      // unset here) therefore spells it as the string label RFC 9052 §1.5 permits
      // (`label = int / tstr`); the integer is what `proprietary: true` writes.
      // `excludes` states the two apart, since the record compares stringified keys.
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
    format: { jose: "jwe", cose: "cwe" },
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
      "RFC 8392 §1.1 lets a CWT key its claims by integer as well as by string, and its IANA registration policy marks 'Integer values less than -65536' as Private Use. A platform token keyed by the compact private-use labels is smaller; an off-platform one must not be, because no foreign reader can resolve a private label. The knob is the only way to say which is being minted, so dropping it emits an uninteroperable token to an external party.",
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
      jose: "A JOSE claims set is a JSON object, whose members RFC 7519 §4 calls Claim Names — 'The JWT Claims Set represents a JSON object whose members are the claims conveyed by the JWT' — and a JSON member name is a string. The compact form this knob selects is an INTEGER map key, which RFC 8392 §1.1 introduces as a property of CBOR alone: 'In JSON, maps are called objects and only have one kind of map key: a string. CBOR uses strings, negative integers, and unsigned integers as map keys.' There is no JOSE encoding for the thing being switched on.",
    },
  },

  omit: {
    rationale:
      "An empty claim is not the same statement as an absent one: `amr: []` asserts that the authentication methods are KNOWN and none apply, while omitting `amr` asserts nothing. The prune mode is how an issuer chooses between the two, so a dropped one changes what the token says about the subject.",
    value: "undefined",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: { ...ID_TOKEN_CONTENT, authMethods: [] },
        options: { context: { accessTokenIssued: false } },
      },
    ],
    observed: [
      { step: "wireClaims", on: "jose", present: ["amr"] },
      { step: "wireClaims", on: "cose", present: ["amr"] },
    ],
  },
} satisfies KnobProbes<ProfileMintOptions>;

// ---------------------------------------------------------------------------
// ProfileMintOptions["sign"] — SignTokenOptions
// ---------------------------------------------------------------------------

/** The signing envelope's own leaves, each threaded separately into the wire. */
export const MINT_SIGN_KNOB_PROBES = {
  accessTokenHash: {
    rationale:
      "OIDC Core §3.1.3.6 defines `at_hash` as the left half of the hash of the co-issued access token, and it is what ties the id_token to that access token. Dropped, the id_token makes no statement about the access token at all and the binding a relying party checks simply is not there.",
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
      "OIDC Core §3.3.2.11 defines `c_hash` for the hybrid flow, where the id_token is delivered from the authorization endpoint alongside the code and is the only thing binding the two. Without it a code substituted in transit is indistinguishable from the one the id_token was issued for.",
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
      "RFC 7519 §4.1.6 defines `iat` as when the token was issued, and an issuer that backdates or replays one states the instant explicitly. Dropped, the token claims to have been issued at the moment of encoding, which is a false statement about provenance and defeats every freshness bound computed from it.",
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
      "`s_hash` is a FAPI claim, not an OIDC Core one — Financial-grade API Security Profile 1.0 Part 2 (Advanced) §5.1.1 defines it as 'the base64url encoding of the left-most half of the hash of the octets of the ASCII representation of the state value, where the hash algorithm used is the hash algorithm used in the alg header parameter of the ID Token's JOSE header', §5.2.2.1 requires an authorization server to 'include state hash, s_hash, in the ID Token to protect the state value if the client supplied a value for state', and §5.2.3.1 requires the client to 'verify that s_hash value is equal to the value calculated from the state value in the authorization response'. It is what lets a client detect a response grafted onto a different request, so a dropped hash claim removes the attestation while leaving the client believing it was made.",
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
      "RFC 7519 §4.1.7 makes `jti` the identifier a replay check keys on, and an issuer that has to correlate the token with something it already stored supplies its own. Dropped, the stored identifier and the token's identifier are different values, so every lookup against it misses.",
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
      // RFC 8392 §3.1.7 makes the CWT `cti` a byte string, so its VALUE never
      // equals the text it spells — presence is the assertion available here.
      { step: "wireClaims", on: "cose", present: [7] },
    ],
  },

  typ: {
    rationale:
      "RFC 8725 §3.11 recommends explicit typing, and a profile that mandates no type of its own leaves the choice to the caller — an issuer emitting an application-specific artifact says what it is. Dropped, the token carries the bare conventional type instead, which is precisely the ambiguity explicit typing exists to remove.",
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
    // observation cannot demonstrate anything there — it is simply skipped, so
    // it holds vacuously on the wire the shortfall is claimed on. The COSE
    // spelling is the caller's media type with the structured suffix the wire
    // uses: a COSE object is a CWT, so `+jwt` becomes `+cwt` (RFC 9596 label 16,
    // the same translation `coseTyp` applies to a profile's own typ).
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
    defect: {
      site: "src/internal/wire/cose-token-wire.ts#mintTypPrefix:",
      note: "`mintTypPrefix` on the COSE wire reads the PROFILE's typ and nothing else — the caller's explicit `sign.typ` and the content's own `tokenType` are both accepted and dropped, so a COSE token minted under a profile that mandates no type always carries the bare `application/cwt`.",
      wires: ["cose"],
    },
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
          sign: { key: { condition: { id: CERT_SIG_KEY_ID } } },
        },
      },
    ],
    // The chain is representable on BOTH wires — RFC 9360 §2 registers
    // `x5chain` at label 33 — so the COSE side is observed too. Without it the
    // defect declared below sits on a wire the probe never looks at.
    observed: [
      // The CONTENTS, not merely the presence: RFC 7515 §4.1.6 fixes both the
      // encoding (base64, not base64url, of the DER certificate) and the order
      // ("The certificate containing the public key corresponding to the key
      // used to digitally sign the JWS MUST be the first certificate"). A
      // truncated, reversed or PEM-armoured chain is still an `x5c`, and it is
      // one no relying party can build a path from.
      { step: "wireProtectedHeader", on: "jose", includes: { x5c: TEST_X509_CHAIN_B64 } },
      { step: "wireProtectedHeader", on: "cose", present: [33] },
    ],
    defect: {
      site: "src/internal/cose/sign-cwt.ts#export const signCwt = (",
      note: "The COSE `signClaims` no longer OMITS the cert-binding options — it forwards its whole kit surface by rest-spread — but there is nothing to forward them to: `signCwt` never calls `resolveCertBinding`, so no COSE writer derives a binding, and the wire therefore declares `bindCertificate` `unsupported` (`src/internal/wire/cose-token-wire.ts#const NO_COSE_CERT_BINDING =`) and REFUSES this mint above the seam rather than issuing a token that is silently unbound. The refusal is the honest answer to a request this wire cannot serve; it is not the EMISSION this probe observes, so the probe stays red until the capability exists. It is not a wire limitation: RFC 9360 §2 registers `x5chain` (label 33) and `x5t` (label 34) as COSE header parameters.",
      wires: ["cose"],
    },
  },

  certificateThumbprintSha1: {
    rationale:
      "The SHA-1 thumbprint rides alongside the SHA-256 one purely for older clients, and the read side never verifies it. An issuer suppressing it is removing a legacy value with a broken hash from its wire; dropped, the option leaves that value on every token it was asked to keep off.",
    value: false,
    given: [
      { step: "keys", keys: ["ec-sig-cert"] },
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: ID_TOKEN_CONTENT,
        options: {
          context: { accessTokenIssued: false },
          sign: { key: { condition: { id: CERT_SIG_KEY_ID } } },
        },
      },
    ],
    // ⚠ `present` as well as `excludes`: the flag suppresses the LEGACY digest
    // and nothing else, so a suppression that also dropped `x5t#S256` would
    // silently unbind the token — a stronger effect than the caller asked for,
    // and one an exclusion-only observation cannot see.
    observed: [
      {
        step: "wireProtectedHeader",
        on: "jose",
        present: ["x5t#S256"],
        excludes: ["x5t"],
      },
    ],
    // ⚠ UNOBSERVABLE on COSE, not merely undelivered. The COSE wire does have a
    // cert-binding shortfall — `bindCertificate` above declares it — but this
    // knob would still have nothing to act on once that is repaired, which is a
    // different kind of statement and belongs in a different field.
    unobservable: {
      cose: "COSE has ONE certificate-thumbprint parameter, not the JOSE pair this knob chooses between. RFC 9360 §2 registers `x5t` at label 34 as a COSE_CertHash — `COSE_CertHash = [ hashAlg: (int / tstr), hashValue: bstr ]` — whose 'first element is an algorithm identifier ... corresponding to the Value column (integer or text string) of the algorithm registered in the \"COSE Algorithms\" registry'. The digest algorithm is therefore a MEMBER of the one parameter rather than part of two parameter names, so there is no separate legacy thumbprint riding alongside the binding one for a suppression to remove.",
    },
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
      // ⚠ The TEXT label `oid`, not the integer -70000. `oid` has no IANA COSE
      // parameter, so it rides a lindorm PRIVATE-USE label — RFC 8152 §16.2,
      // "Integer values less than -65536 are marked as private use" — which a
      // foreign reader cannot interpret. The interoperable default (`proprietary`
      // unset here) therefore spells it as the string label RFC 9052 §1.5 permits
      // (`label = int / tstr`); the integer is what `proprietary: true` writes.
      // `excludes` states the two apart, since the record compares stringified keys.
      {
        step: "wireProtectedHeader",
        on: "cose",
        includes: { oid: "1.2.3.4" },
        excludes: [-70000],
      },
    ],
  },

  omit: {
    rationale:
      "The signing envelope carries its own prune mode as the fallback for a caller that states one there rather than at the top level. A fallback that is never consulted is a surface that documents a choice the caller does not actually have.",
    value: "undefined",
    given: [
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: { ...ID_TOKEN_CONTENT, authMethods: [] },
        options: { context: { accessTokenIssued: false } },
      },
    ],
    observed: [
      { step: "wireClaims", on: "jose", present: ["amr"] },
      { step: "wireClaims", on: "cose", present: ["amr"] },
    ],
  },

  key: {
    rationale:
      "Which key signs the token decides who can verify it and what the signature proves. A deployment pinning a key — a per-client algorithm, a specific `kid` — has made a statement its recipients depend on, and a dropped selector silently signs with whatever the vault returns first instead.",
    value: { condition: { id: OKP_SIG_KEY_ID } },
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
          sign: { key: { condition: { id: SIG_KEY_ID } } },
        },
      },
    ],
    observed: [
      { step: "wireProtectedHeader", on: "jose", includes: { alg: "EdDSA" } },
      // RFC 9053 §2.2 registers EdDSA as COSE algorithm -8; the baseline ES512
      // key is -36, so the resolved key is legible from the protected bucket.
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
      // ⚠ The TEXT label `oid`, not the integer -70000. `oid` has no IANA COSE
      // parameter, so it rides a lindorm PRIVATE-USE label — RFC 8152 §16.2,
      // "Integer values less than -65536 are marked as private use" — which a
      // foreign reader cannot interpret. The interoperable default (`proprietary`
      // unset here) therefore spells it as the string label RFC 9052 §1.5 permits
      // (`label = int / tstr`); the integer is what `proprietary: true` writes.
      // `excludes` states the two apart, since the record compares stringified keys.
      {
        step: "wireProtectedHeader",
        on: "cose",
        includes: { oid: "1.2.3.4" },
        excludes: [-70000],
      },
    ],
    defect: {
      site: "src/internal/utils/mint-token.ts#const token = encryptOuter(wire, {",
      note: "`encryptOuter` is called with a NAMED subset of the encrypt envelope — `partyProducer`, `partyRecipient`, `certificateThumbprintSha1` — so `header` never reaches the outer on either wire.",
    },
  },

  unprotected: {
    // ⚠ A REFUSAL probe, and it has to be. RFC 9052 §3 does give a COSE structure
    // an unprotected bucket, but aegis — not the caller — decides which bucket a
    // parameter travels in, and the header registry marks EVERY caller-settable
    // parameter `placement: "protected"`; the two it marks `either` (`kid`, `iv`)
    // are kit-derived and refused from a caller bag by the reserved rule. So no
    // value of this bag can ever reach the wire, and an EMISSION probe would be
    // stating an outcome that cannot exist. What the bag can do is be REFUSED —
    // the same refusal the scenario row
    // `a-parameter-that-must-be-signed-is-refused-from-the-unprotected-bucket`
    // pins on the signing door.
    rationale:
      "A parameter a recipient relies on must be one the issuer authenticated, so aegis decides the bucket and refuses a caller that tries to place an integrity-protected parameter in the unauthenticated one (RFC 9052 §3 covers the protected bucket and leaves the other uncovered). Reading the bag is what makes that refusal happen. Dropped, the request simply evaporates: the caller believes a parameter is riding on the outer, the outer carries nothing, and nothing anywhere reports the difference — which is worse than either honest answer.",
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
    baseline: "accepts",
    flipped: "rejects",
    unobservable: {
      jose: "There is no bucket to put it in, and so no placement for a rule to refuse. RFC 7516 §7.1 — 'Only one recipient is supported by the JWE Compact Serialization and it provides no syntax to represent JWE Shared Unprotected Header, JWE Per-Recipient Unprotected Header, or JWE AAD values.' aegis emits the compact serialisation, so the parameter has nowhere to go on the JOSE wire; the bucket the COSE refusal is about is one RFC 9052 §3 gives COSE structures alone, and the JOSE kits take the bag only so one option type serves both wires.",
    },
    defect: {
      site: "src/internal/utils/mint-token.ts#const token = encryptOuter(wire, {",
      note: "Same named subset as `header`: the encrypt envelope's `unprotected` bag never reaches `encryptOuter`, so the mint SUCCEEDS where the placement rule would refuse it and the bag is accepted and dropped.",
      wires: ["cose"],
    },
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
    defect: {
      site: "src/internal/utils/mint-token.ts#const token = encryptOuter(wire, {",
      note: "`encryptOuter` is handed the tokenType derived from the PROFILE, and the encrypt envelope's own `tokenType` is not among the named fields forwarded, so a caller's outer type is accepted and dropped on both wires.",
    },
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
          encrypt: { key: { condition: { id: CERT_ENC_KEY_ID } } },
        },
      },
    ],
    observed: [{ step: "wireProtectedHeader", on: "jose", present: ["x5c"] }],
    unobservable: {
      cose: "A COSE_Encrypt0 has no certificate to bind. RFC 9052 §5.2 defines it as direct encryption — the recipient key IS the content-encryption key — so a `cwe` recipient is necessarily a symmetric `dir` key, and a symmetric key carries no X.509 certificate for a thumbprint or a chain to be derived from. The parameters themselves are representable (RFC 9360 §2 registers `x5chain` 33 and `x5t` 34); what cannot exist on this wire is a cert-bearing recipient.",
    },
    defect: {
      site: "src/internal/utils/mint-token.ts#const token = encryptOuter(wire, {",
      note: "Not among the named fields forwarded to `encryptOuter`, so the encrypt envelope's binding mode never reaches the JOSE outer.",
      wires: ["jose"],
    },
  },

  certificateThumbprintSha1: {
    rationale:
      "The SHA-1 thumbprint is emitted alongside the SHA-256 one for older recipients and is never verified. Suppressing it on the encrypting outer is the caller's call, and an option that cannot suppress it leaves a broken-hash value on every outer.",
    value: false,
    given: [
      { step: "keys", keys: ["ec-enc-cert"] },
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: ID_TOKEN_CONTENT,
        options: {
          context: { accessTokenIssued: false },
          encrypt: { key: { condition: { id: CERT_ENC_KEY_ID } } },
        },
      },
    ],
    // ⚠ `present` as well as `excludes`: the flag suppresses the LEGACY digest
    // and nothing else, so a suppression that also dropped `x5t#S256` would
    // silently unbind the token — a stronger effect than the caller asked for,
    // and one an exclusion-only observation cannot see.
    observed: [
      {
        step: "wireProtectedHeader",
        on: "jose",
        present: ["x5t#S256"],
        excludes: ["x5t"],
      },
    ],
    unobservable: {
      cose: "A COSE_Encrypt0 has no certificate to bind. RFC 9052 §5.2 defines it as direct encryption — the recipient key IS the content-encryption key — so a `cwe` recipient is necessarily a symmetric `dir` key, and a symmetric key carries no X.509 certificate for a thumbprint or a chain to be derived from. The parameters themselves are representable (RFC 9360 §2 registers `x5chain` 33 and `x5t` 34); what cannot exist on this wire is a cert-bearing recipient.",
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
          encrypt: { key: { condition: { id: OCT_ENC_CBC_KEY_ID } } },
        },
      },
    ],
    baseline: "rejects",
    flipped: "accepts",
    unobservable: {
      jose: "There is no gate to open. RFC 7518 §5.2.3 registers `A128CBC-HS256` as a standard JOSE `enc` value, so the AES-CBC-HMAC family is fully interoperable on that wire; RFC 9053 §4 registers the COSE content-encryption algorithms — AES-GCM (§4.1), AES-CCM (§4.2) and ChaCha20/Poly1305 (§4.3) — and no AES-CBC-HMAC among them, which is what makes the same cipher private-use there and gives this knob something to decide.",
    },
    defect: {
      site: "src/internal/utils/mint-token.ts#const token = encryptOuter(wire, {",
      note: "`encryptOuter` is handed the MINT-level `options.proprietary`; the encrypt envelope's own `proprietary` is not forwarded, so an outer-specific interop decision cannot be stated.",
      wires: ["cose"],
    },
  },

  partyProducer: {
    rationale:
      "RFC 7518 §4.6.1.2 makes `apu` an input to the ECDH-ES Concat-KDF as well as a header parameter, so it is part of what derives the content key: producer and recipient must agree on it or the ciphertext does not open. A dropped `apu` therefore does not merely omit a header — it derives a different key than the recipient expects.",
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
      cose: "RFC 7518 §4.6 defines `apu` as a JOSE Header Parameter 'for key agreement algorithms using it (such as \"ECDH-ES\")', and aegis's COSE outer is a COSE_Encrypt0 — RFC 9052 §5.2 defines that structure as a single-recipient direct encryption, so there is no key-agreement step for PartyUInfo to feed and no COSE header parameter registered to carry it.",
    },
  },

  partyRecipient: {
    rationale:
      "RFC 7518 §4.6.1.3 makes `apv` the recipient half of the same Concat-KDF input, and the read side compares the incoming value against the one it was configured with. It is therefore both a key-derivation input and an assertion about who the ciphertext was written to; dropping it removes both at once.",
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
      cose: "Shares `partyProducer`'s reason exactly: RFC 7518 §4.6 scopes `apv` to JOSE key-agreement algorithms, and a COSE_Encrypt0 (RFC 9052 §5.2) performs no key agreement.",
    },
  },

  key: {
    rationale:
      "The recipient key IS the addressee: it decides who can open the token. A dropped selector seals the token to whatever the vault returns first, which is the one mistake in this family that cannot be detected by the intended recipient — they simply cannot decrypt, and the token looks well-formed to everyone else.",
    value: { condition: { id: OCT_ENC_GCM128_KEY_ID } },
    given: [
      { step: "keys", keys: ["oct-enc", "oct-enc-gcm128"] },
      {
        step: "token",
        via: "mint",
        profile: "id_token",
        content: ID_TOKEN_CONTENT,
        options: {
          context: { accessTokenIssued: false },
          encrypt: { key: { condition: { id: OCT_ENC_KEY_ID } } },
        },
      },
    ],
    // The resolved key is legible from the CONTENT ENCRYPTION it declares, on
    // both wires. The recipient `kid` is not: RFC 9052 §3.1 puts it in the
    // unprotected bucket as a byte string, which no literal here can equal.
    observed: [
      { step: "wireProtectedHeader", on: "jose", includes: { enc: "A128GCM" } },
      { step: "wireProtectedHeader", on: "cose", includes: { "1": 1 } },
    ],
  },
} satisfies KnobProbes<JweEncryptOptions & { key?: AegisEncKey }>;

// ---------------------------------------------------------------------------
// ProfileMintOptions["context"] — SignContext
// ---------------------------------------------------------------------------

/** The mint-time facts a policy rule may read. Closed, and each one is enforced. */
export const MINT_CONTEXT_KNOB_PROBES = {
  accessTokenIssued: {
    rationale:
      "OIDC Core §3.1.3.6 makes `at_hash` OPTIONAL in the code flow, and aegis requires it whenever an access token co-issues — a fact only the issuer holds. The enforcer refuses to evaluate the rule without it precisely because an unsupplied fact and a `false` one are indistinguishable from inside, and the unsupplied case is the one that must not mint.",
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
        options: { key: { condition: { id: CERT_ENC_KEY_ID } } },
      },
    ],
    observed: [{ step: "wireProtectedHeader", on: "jose", present: ["x5c"] }],
    unobservable: {
      cose: "A COSE_Encrypt0 has no certificate to bind. RFC 9052 §5.2 defines it as direct encryption — the recipient key IS the content-encryption key — so a `cwe` recipient is necessarily a symmetric `dir` key, and a symmetric key carries no X.509 certificate for a thumbprint or a chain to be derived from. The parameters themselves are representable (RFC 9360 §2 registers `x5chain` 33 and `x5t` 34); what cannot exist on this wire is a cert-bearing recipient.",
    },
  },

  certificateThumbprintSha1: {
    rationale:
      "The SHA-1 thumbprint travels beside the SHA-256 one for older recipients and is never verified by the read side. A caller suppressing it is removing a broken-hash value from its wire, and an option that cannot do so leaves that value on every token.",
    value: false,
    given: [
      { step: "keys", keys: ["ec-enc-cert"] },
      {
        step: "token",
        via: "domain-encrypt",
        data: { subject: "user-1" },
        options: { key: { condition: { id: CERT_ENC_KEY_ID } } },
      },
    ],
    // ⚠ `present` as well as `excludes`: the flag suppresses the LEGACY digest
    // and nothing else, so a suppression that also dropped `x5t#S256` would
    // silently unbind the token — a stronger effect than the caller asked for,
    // and one an exclusion-only observation cannot see.
    observed: [
      {
        step: "wireProtectedHeader",
        on: "jose",
        present: ["x5t#S256"],
        excludes: ["x5t"],
      },
    ],
    unobservable: {
      cose: "A COSE_Encrypt0 has no certificate to bind. RFC 9052 §5.2 defines it as direct encryption — the recipient key IS the content-encryption key — so a `cwe` recipient is necessarily a symmetric `dir` key, and a symmetric key carries no X.509 certificate for a thumbprint or a chain to be derived from. The parameters themselves are representable (RFC 9360 §2 registers `x5chain` 33 and `x5t` 34); what cannot exist on this wire is a cert-bearing recipient.",
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
      // ⚠ The TEXT label `oid`, not the integer -70000. `oid` has no IANA COSE
      // parameter, so it rides a lindorm PRIVATE-USE label — RFC 8152 §16.2,
      // "Integer values less than -65536 are marked as private use" — which a
      // foreign reader cannot interpret. The interoperable default (`proprietary`
      // unset here) therefore spells it as the string label RFC 9052 §1.5 permits
      // (`label = int / tstr`); the integer is what `proprietary: true` writes.
      // `excludes` states the two apart, since the record compares stringified keys.
      {
        step: "wireProtectedHeader",
        on: "cose",
        includes: { oid: "1.2.3.4" },
        excludes: [-70000],
      },
    ],
  },

  omit: {
    rationale:
      "An empty entry and an absent one are different statements, and on this verb the caller alone makes the choice: the seal preserves whatever it is handed, so the only way to have an empty entry pruned is to ask. A caller assembling a payload from optional values and stating the prune gets a compact sealed value; an unread mode leaves every unset field in it, and the recipient decrypts to a value the writer did not intend to send.",
    // ⚠ THE PRUNE IS THE FLIP, not the keep. This verb prunes NOTHING unless
    // asked (`src/internal/utils/encrypt-token.ts#const payload =` — pruning
    // shapes a claim set and there is no claims layer here), so the baseline
    // already keeps the empty entry and a `"undefined"` flip would agree with
    // it. `"empty"` is the mode with something to prove: it must REMOVE what the
    // baseline keeps.
    value: "empty",
    given: [
      { step: "keys", keys: ["oct-enc"] },
      {
        step: "token",
        via: "domain-encrypt",
        data: { subject: "user-1", authMethods: [] },
      },
    ],
    act: { step: "decrypt" },
    // Observed on the PAYLOAD, under the caller's own key: `decrypt` returns the
    // value it was handed and has no claim buckets to sort it into. The
    // EXCLUSION is what carries the difference — an object payload is matched as
    // a subset, so the surviving `subject` alone would hold on both runs.
    observed: [
      { step: "raw", expected: { subject: "user-1" }, excludes: ["authMethods"] },
    ],
  },

  key: {
    rationale:
      "The recipient key IS the addressee. A dropped selector seals the content to whatever the vault returns first, and the failure is invisible to everyone except the intended recipient — who simply cannot open it.",
    value: { condition: { id: OCT_ENC_GCM128_KEY_ID } },
    given: [
      { step: "keys", keys: ["oct-enc", "oct-enc-gcm128"] },
      {
        step: "token",
        via: "domain-encrypt",
        data: { subject: "user-1" },
        options: { key: { condition: { id: OCT_ENC_KEY_ID } } },
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
      "RFC 7518 §4.6.1.2 feeds `apu` into the ECDH-ES Concat-KDF as well as emitting it, so producer and recipient must agree on the value or the derived content key differs. Dropping it does not omit a header — it derives a different key than the recipient will.",
    value: "cHJvZHVjZXI",
    given: [
      { step: "keys", keys: ["ec-enc"] },
      { step: "token", via: "domain-encrypt", data: { subject: "user-1" } },
    ],
    observed: [{ step: "wireProtectedHeader", on: "jose", present: ["apu"] }],
    unobservable: {
      cose: "RFC 7518 §4.6 defines `apu` as a JOSE Header Parameter 'for key agreement algorithms using it (such as \"ECDH-ES\")'. aegis's `cwe` is a COSE_Encrypt0, which RFC 9052 §5.2 defines as single-recipient direct encryption — no key agreement, so no PartyUInfo to supply and no COSE header parameter for it.",
    },
  },

  partyRecipient: {
    rationale:
      "RFC 7518 §4.6.1.3 makes `apv` the recipient half of the same derivation, and a decrypt configured with one checks the incoming value against it. It is a key-derivation input and an assertion about the addressee at once; a dropped one loses both.",
    value: "cmVjaXBpZW50",
    given: [
      { step: "keys", keys: ["ec-enc"] },
      { step: "token", via: "domain-encrypt", data: { subject: "user-1" } },
    ],
    observed: [{ step: "wireProtectedHeader", on: "jose", present: ["apv"] }],
    unobservable: {
      cose: "Shares `partyProducer`'s reason: RFC 7518 §4.6 scopes `apv` to JOSE key-agreement algorithms, and a COSE_Encrypt0 (RFC 9052 §5.2) performs none.",
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
        options: { key: { condition: { id: OCT_ENC_CBC_KEY_ID } } },
      },
    ],
    baseline: "rejects",
    flipped: "accepts",
    unobservable: {
      jose: "There is no gate to open. RFC 7518 §5.2.3 registers `A128CBC-HS256` as a standard JOSE `enc` value, while RFC 9053 §4 registers the COSE content-encryption algorithms — AES-GCM (§4.1), AES-CCM (§4.2) and ChaCha20/Poly1305 (§4.3) — and no AES-CBC-HMAC among them, which is what makes the same cipher private-use on that wire and gives this knob something to decide.",
    },
  },
} satisfies KnobProbes<EncryptOptions>;
