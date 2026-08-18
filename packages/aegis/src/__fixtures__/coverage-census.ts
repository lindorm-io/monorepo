import type { BuiltInProfiles } from "../internal/profiles/built-in-profiles.js";
import type { KitCapabilities } from "../internal/registry/capabilities.js";
import type { PolicyRule, ShapeRuleName, TokenFormatTag } from "../types/index.js";

/**
 * THE COVERAGE CENSUS — one entry per member of every collection this package
 * enumerates, stating what EXERCISES it.
 *
 * A generated matrix decays the same way a hand-written suite does, and faster:
 * it looks total. The scenario matrix runs 28 rows, the knob matrix one probe per
 * option, the per-spec matrix one cell per registry entry — and none of them can
 * say whether a PROFILE, a POLICY RULE or a KIT CAPABILITY is exercised by
 * anything at all. This is where each of those is bound to something that runs,
 * or carries an explicit reasoned disposition.
 *
 * ⚠ TWO BINDING MECHANISMS, and the choice between them is not stylistic:
 *   - where a TYPE-LEVEL UNION exists, the census is a TOTAL MAPPED TYPE over it
 *     (`Record<ShapeRuleName, …>`, `-?`), so a new member is a COMPILE error;
 *   - where none exists — a policy-rule INSTANCE has no type — the census is
 *     compared at RUNTIME against the real collection, derived from the profiles
 *     themselves.
 * A census compared against a re-derivation of itself would satisfy both and
 * prove neither.
 */

/** How a census member is exercised. */
export type CensusEntry =
  /** A generated matrix runs it. The matrix is named and the meta suite checks it. */
  | { exercised: "matrix"; matrix: MatrixName }
  /** Production code READS the value, and a test observes the resulting behaviour. */
  | { exercised: "reader"; site: string }
  /** A test observes the kit's own behaviour, without the kit reading this value. */
  | { exercised: "observed"; note: string }
  /** Nothing runs it, and the reason is stated. A DECLARATION, never a default. */
  | { exercised: "declared"; reason: string };

/** The generated matrices a census entry may name. */
export type MatrixName = "scenario" | "knob" | "spec" | "policy";

/**
 * Every built-in profile, and what exercises it.
 *
 * TOTAL over `keyof BuiltInProfiles`, so a twelfth profile is a compile error
 * here; the meta suite ALSO compares this key set to the names the profile
 * registry actually resolves, which is what catches a profile added to the
 * registry without a type member.
 */
export const PROFILE_CENSUS: { [P in keyof BuiltInProfiles]-?: CensusEntry } = {
  access_token: { exercised: "matrix", matrix: "policy" },
  default: { exercised: "matrix", matrix: "policy" },
  delegation: { exercised: "matrix", matrix: "policy" },
  erasure_token: { exercised: "matrix", matrix: "policy" },
  external_access_token: { exercised: "matrix", matrix: "policy" },
  id_token: { exercised: "matrix", matrix: "policy" },
  introspection: { exercised: "matrix", matrix: "policy" },
  jarm: { exercised: "matrix", matrix: "policy" },
  logout_token: { exercised: "matrix", matrix: "policy" },
  security_event: { exercised: "matrix", matrix: "policy" },
  userinfo: { exercised: "matrix", matrix: "policy" },
};

/**
 * Every policy-rule KIND. TOTAL over the `rule` discriminant of
 * {@link PolicyRule}, so a seventh kind is a compile error.
 */
export const RULE_KIND_CENSUS: { [K in PolicyRule["rule"]]-?: CensusEntry } = {
  required: { exercised: "matrix", matrix: "policy" },
  forbidden: { exercised: "matrix", matrix: "policy" },
  atLeastOneOf: { exercised: "matrix", matrix: "policy" },
  match: { exercised: "matrix", matrix: "policy" },
  shape: { exercised: "matrix", matrix: "policy" },
  requiredWhen: { exercised: "matrix", matrix: "policy" },
};

/** Every named structural validator. TOTAL over {@link ShapeRuleName}. */
export const SHAPE_RULE_CENSUS: { [S in ShapeRuleName]-?: CensusEntry } = {
  actChain: { exercised: "matrix", matrix: "policy" },
  confirmation: { exercised: "matrix", matrix: "policy" },
  crossField: { exercised: "matrix", matrix: "policy" },
  events: { exercised: "matrix", matrix: "policy" },
  subjectId: { exercised: "matrix", matrix: "policy" },
};

/**
 * THE 49 KIT-CAPABILITY CELLS — seven kits × seven columns, TOTAL in both
 * directions, so a new kit or a new column is a compile error here.
 *
 * ⚠ NINE of the forty-nine have a production reader. The other forty are
 * declarations about a kit, and a declaration nothing consults is a comment with
 * a type: the table's whole premise is that a kit reads its own row, and for
 * most of the table that is not yet true. Each such cell therefore says whether
 * a test OBSERVES the kit doing what the cell claims — which is a real binding
 * even without a reader — or states that it does not and why.
 */
export const KIT_CELL_CENSUS: {
  [F in TokenFormatTag]-?: { [C in keyof KitCapabilities]-?: CensusEntry };
} = {
  jwt: {
    wire: { exercised: "observed", note: "a JOSE kit mints a compact STRING" },
    keyManagement: {
      exercised: "declared",
      reason:
        "An EMPTY set on a signing kit. There is no key-management call to observe and no reader — the emptiness is what the kit's SHAPE already says, since it signs rather than seals.",
    },
    contentEncryption: {
      exercised: "declared",
      reason:
        "Empty for the same reason as `keyManagement`: a signing kit performs no content encryption, so there is nothing to observe.",
    },
    cnfMembers: {
      exercised: "observed",
      note: "the members `domainToJose` emits for a fully-populated confirmation ARE the JOSE capability",
    },
    certificateBinding: {
      exercised: "observed",
      note: "a cert-less key makes `resolveCertBinding` throw, so a kit that calls it throws and a kit that does not mints",
    },
    unprotectedBucket: {
      exercised: "observed",
      note: "the bucket the kit's OWN derived kid lands in — element 1 on a COSE structure, the sole protected header on a JOSE one",
    },
    reserved: {
      exercised: "reader",
      site: "src/classes/JwtKit.ts#reserved: KIT_CAPABILITIES.jwt.reserved",
      // The kit hands its row to `buildJoseHeader`, which strips every param on
      // it out of the caller's bag. It used to have no reader at all — the
      // guarantee was SPREAD ORDER, which is what silently lost a caller `jku`.
    },
  },
  jws: {
    wire: { exercised: "observed", note: "a JOSE kit mints a compact STRING" },
    keyManagement: {
      exercised: "declared",
      reason: "Empty on a signing kit — nothing to observe, no reader.",
    },
    contentEncryption: {
      exercised: "declared",
      reason: "Empty on a signing kit — nothing to observe, no reader.",
    },
    cnfMembers: {
      exercised: "declared",
      reason:
        "Empty because an OPAQUE kit has no claims layer at all, so there is no `cnf` producer to probe. The emptiness is held by the kit's SHAPE — it signs bytes, not claims — which the type system already enforces.",
    },
    certificateBinding: {
      exercised: "observed",
      note: "the cert-less-key probe, as for `jwt`",
    },
    unprotectedBucket: {
      exercised: "observed",
      note: "the scenario row `a-wire-with-no-unprotected-bucket-signs-every-parameter-it-carries` reads the token's raw bytes and finds no such bucket — RFC 7515 §7.1 gives the compact serialisation none, which holds for every kit on this wire",
    },
    reserved: {
      exercised: "reader",
      site: "src/classes/JwsKit.ts#reserved: KIT_CAPABILITIES.jws.reserved",
    },
  },
  jwe: {
    wire: { exercised: "observed", note: "a JOSE kit mints a compact STRING" },
    keyManagement: {
      exercised: "declared",
      reason:
        "NOT YET BINDABLE. `JweKit` delegates the whole key-management matrix to `@lindorm/aes` without consulting a row, so the column has no runtime witness on the JOSE side. Its declared value is `new Set(KRYPTOS_ENC_ALGORITHMS)` — built FROM kryptos's own constant, so comparing it to that constant is an identity and proves nothing either.",
    },
    contentEncryption: {
      exercised: "reader",
      site: "src/internal/utils/jose-header.ts#KIT_CAPABILITIES.jwe.contentEncryption.has(",
      // The JOSE header decoder allowlists an incoming `enc` off this row.
    },
    cnfMembers: {
      exercised: "observed",
      note: "shares the JOSE set with `jwt`, observed through `domainToJose`",
    },
    certificateBinding: {
      exercised: "observed",
      note: "the cert-less-key probe, as for `jwt`",
    },
    unprotectedBucket: {
      exercised: "observed",
      note: "the scenario row `a-wire-with-no-unprotected-bucket-signs-every-parameter-it-carries` reads the token's raw bytes and finds no such bucket — RFC 7515 §7.1 gives the compact serialisation none, which holds for every kit on this wire",
    },
    reserved: {
      exercised: "reader",
      site: "src/classes/JweKit.ts#reserved: KIT_CAPABILITIES.jwe.reserved",
      // The widest JOSE row, and now EXACTLY the KitOwned type-level set — the
      // runtime backstop and the compile-time Omit stating one set, not two.
    },
  },
  cwt: {
    wire: { exercised: "observed", note: "a COSE kit mints CBOR BYTES" },
    keyManagement: {
      exercised: "declared",
      reason: "Empty on a signing kit — nothing to observe, no reader.",
    },
    contentEncryption: {
      exercised: "declared",
      reason: "Empty on a signing kit — nothing to observe, no reader.",
    },
    cnfMembers: {
      exercised: "observed",
      // ⚠ It WAS a reader: `encodeCnf` read this row to decide what to refuse.
      // The direction is now INVERTED — the row is DERIVED from the label table
      // the codec switches over — so nothing reads it back. That is a tighter
      // binding than the read, not a looser one: the encoder cannot represent a
      // member the row omits because there is no second list to disagree with.
      note: "DERIVED from `src/internal/claims/cnf-members.ts#export const COSE_CNF_LABELS`, itself derived from the `wire.cose` cell of each declared member, whose test pins the resulting table against a hand-written literal AND NOTHING ELSE. The behaviour is driven one file over, at `src/internal/cose/cose-key.test.ts#encodeCnf({ jwk: CNF_JWK, kid: 42 })` and the rows beside it: a mixed `{ jwk, kid }` writes BOTH labels, a malformed member refuses instead of dropping, and a member with no label (`jkt`) fails the map closed",
    },
    certificateBinding: {
      exercised: "observed",
      note: "`false`, and observed: the cert-less-key probe mints happily, which is the accept-and-inert the `false` records",
    },
    unprotectedBucket: {
      exercised: "observed",
      note: "the scenario rows `an-unprotected-routing-hint-reaches-the-domain-header`, `an-unauthenticated-parameter-cannot-restate-a-signed-one` and `an-unauthenticated-parameter-a-verifier-decides-by-is-ignored` read the raw bucket off the wire — RFC 9052 §3 gives every COSE structure one, so the fact holds for every kit on this wire",
    },
    reserved: {
      exercised: "reader",
      site: "src/internal/cose/sign-cwt.ts#reserved: KIT_CAPABILITIES[format].reserved",
      // `buildCoseHeaders` refuses a caller value for a listed label off this row.
    },
  },
  cwm: {
    wire: { exercised: "observed", note: "a COSE kit mints CBOR BYTES" },
    keyManagement: {
      exercised: "declared",
      reason: "Empty on a MAC kit — nothing to observe, no reader.",
    },
    contentEncryption: {
      exercised: "declared",
      reason: "Empty on a MAC kit — nothing to observe, no reader.",
    },
    cnfMembers: {
      exercised: "declared",
      reason:
        "Every COSE row derives from the ONE label table — a COSE_Sign1 and a COSE_Mac0 share one claims codec — so this row is the same object as the `cwt` row and consulted nowhere. Its value is checked against the `cwt` row's, which is an identity and not a binding.",
    },
    certificateBinding: {
      exercised: "observed",
      note: "the cert-less-key probe mints happily, which is what `false` records",
    },
    unprotectedBucket: {
      exercised: "observed",
      note: "the scenario rows `an-unprotected-routing-hint-reaches-the-domain-header`, `an-unauthenticated-parameter-cannot-restate-a-signed-one` and `an-unauthenticated-parameter-a-verifier-decides-by-is-ignored` read the raw bucket off the wire — RFC 9052 §3 gives every COSE structure one, so the fact holds for every kit on this wire",
    },
    reserved: {
      exercised: "reader",
      site: "src/internal/cose/sign-cwt.ts#reserved: KIT_CAPABILITIES[format].reserved",
    },
  },
  cws: {
    wire: { exercised: "observed", note: "a COSE kit mints CBOR BYTES" },
    keyManagement: {
      exercised: "declared",
      reason: "Empty on a signing kit — nothing to observe, no reader.",
    },
    contentEncryption: {
      exercised: "declared",
      reason: "Empty on a signing kit — nothing to observe, no reader.",
    },
    cnfMembers: {
      exercised: "declared",
      reason:
        "Empty because an OPAQUE kit has no claims layer, so there is no `cnf` producer to probe — the same shape argument as `jws`.",
    },
    certificateBinding: {
      exercised: "observed",
      note: "the cert-less-key probe mints happily, which is what `false` records",
    },
    unprotectedBucket: {
      exercised: "observed",
      note: "the scenario rows `an-unprotected-routing-hint-reaches-the-domain-header`, `an-unauthenticated-parameter-cannot-restate-a-signed-one` and `an-unauthenticated-parameter-a-verifier-decides-by-is-ignored` read the raw bucket off the wire — RFC 9052 §3 gives every COSE structure one, so the fact holds for every kit on this wire",
    },
    reserved: {
      exercised: "reader",
      site: "src/classes/CwsKit.ts#reserved: KIT_CAPABILITIES.cws.reserved",
    },
  },
  cwe: {
    wire: { exercised: "observed", note: "a COSE kit mints CBOR BYTES" },
    keyManagement: {
      exercised: "reader",
      site: "src/classes/CweKit.ts#if (!CAPABILITIES.keyManagement.has(options.kryptos.algorithm))",
      // The constructor refuses a key whose algorithm is not in this set.
    },
    contentEncryption: {
      exercised: "declared",
      reason:
        "No reader and no witness. `CweKit` gates its KEY MANAGEMENT on its row but hands the content algorithm straight to `@lindorm/aes`, and the declared value is `new Set(AES_ENCRYPTION_ALGORITHMS)` — built from the same constant it would be compared against, so that comparison is an identity.",
    },
    cnfMembers: {
      exercised: "declared",
      reason:
        "Derived from the ONE label table the `cwt` row names, so this row IS that row's object; nothing consults it.",
    },
    certificateBinding: {
      exercised: "observed",
      note: "the cert-less-key probe mints happily, which is what `false` records",
    },
    unprotectedBucket: {
      exercised: "observed",
      note: "the scenario rows `an-unprotected-routing-hint-reaches-the-domain-header`, `an-unauthenticated-parameter-cannot-restate-a-signed-one` and `an-unauthenticated-parameter-a-verifier-decides-by-is-ignored` read the raw bucket off the wire — RFC 9052 §3 gives every COSE structure one, so the fact holds for every kit on this wire",
    },
    reserved: {
      exercised: "reader",
      site: "src/classes/CweKit.ts#reserved: CAPABILITIES.reserved",
      // `buildCoseHeaders` refuses a caller value for a listed label off this row.
    },
  },
};
