/**
 * The single header registry: the one place that maps each JOSE protected header
 * parameter to its aegis DOMAIN name, its spelling on EVERY wire, how its value
 * is shaped, and where it comes from.
 *
 * It is the header-side twin of `internal/claims/claims-registry.ts` and shares
 * the {@link ParamSpec} base with it (`internal/registry/`) — a header parameter
 * and a claim are the same kind of thing, and used to be described by two
 * unrelated types.
 *
 * `token-header.ts` (the header translator, mirroring `claims/translate.ts`) is
 * DATA-DRIVEN: it iterates the actual header data (domain-keyed options on
 * write, wire-keyed decoded claims on read) and looks each key up in the
 * registry. The drift-guard test binds the domain names to `DomainTokenHeader`
 * and the JOSE names to `WireTokenHeader`, so a rename on either side fails the
 * build instead of silently drifting. `internal/cose/*` resolves its integer
 * labels from here via `coseByJose`.
 *
 * --- `absent` is a STATED fact ---
 *
 * Twelve of the twenty-one parameters have no COSE form. That used to be spelled
 * as a missing `cose?: number`, indistinguishable from an oversight, with the
 * reason (where there was one) in a comment. Each now carries a required
 * `reason` on its `absent` wire key, which `coseByJose` reports when it refuses.
 *
 * --- Columns that are currently CONSTANT ---
 *
 * `direction`, `matchable` and `sensitivity` are the same for all twenty-one
 * entries. That is an honest reading of the code, not an omission: every
 * registered parameter flows through the codec in BOTH directions (the registry
 * has carried no per-entry direction flag since the translator became
 * data-driven); there is no header MATCHER door at all, so nothing is assertable;
 * and a header parameter is never encrypted content, so nothing is sensitive.
 * They are declared per entry anyway, so the first parameter that breaks one of
 * those patterns has to say so here.
 *
 * ⚠ `critEligible` USED TO BE A FOURTH and is not one any more — `oid` is
 * `true`. A constant boolean column read by nobody is a note; this one is read
 * from both directions (the mint gate `assert-crit-eligible.ts` and the verify
 * gate `reject-unknown-critical.ts`), so it is what decides whether a `crit`
 * naming a parameter stands.
 *
 * --- `whenEmpty` ---
 *
 * REQUIRED on every entry and with no default, for the same reason the claim
 * registry gives: each verdict fails open in a different direction. TWENTY
 * prune, ONE refuses, NONE keeps.
 *
 * The one `refuse` is `x5t#S256` — the only header parameter aegis's verify
 * enforces, where presence IS the binding, so an empty value can be neither
 * dropped (an unbound token) nor carried (a token no certificate satisfies) and
 * the write throws instead. `x5t` and `x5c` sit beside it and prune, because
 * nothing reads them.
 *
 * ⚠ `keep` HAS NO HEADER USERS, and it is not dead — eleven CLAIMS hold it
 * (`internal/claims/claims-registry.ts`), which is why the union is not narrowed
 * to the two verdicts this registry uses. It is unused HERE because a `keep`
 * needs an empty value a RECIPIENT can act on, and no header parameter has one:
 * the emptiness of a header parameter is either noise (twenty of them) or an
 * unsatisfiable guarantee (one). A header parameter whose empty form says
 * something a recipient can honour — an explicitly empty list that narrows
 * rather than describes — would say `keep`, and this paragraph would change.
 */

import { isNumber } from "@lindorm/is";
import { CoseError } from "../../errors/index.js";
import type { CoseLabel } from "../cose/cose-label.js";
import type { HeaderSpec } from "../registry/header-spec.js";
import { isPrivateUseLabel } from "../registry/is-private-use-label.js";
import type { Directions, Registry } from "../registry/param-spec.js";
import {
  wireAbsent,
  wireKeyLabel,
  wireKeyName,
  wireLabel,
  wireName,
} from "../registry/wire-key.js";

export type {
  HeaderCodec,
  HeaderPlacement,
  HeaderSpec,
} from "../registry/header-spec.js";

/** Every header parameter flows in both directions — see the docstring. */
const BOTH: Directions = ["mint", "verify"];

/**
 * The registry. Ordered alphabetically by JOSE name for readability only — the
 * codec reads neither position nor any direction-scoped subset. Lookups are
 * derived from the Maps below.
 *
 * RFC references: RFC 7515 §4.1 (JWS), RFC 7516 §4.1 (JWE), RFC 7518 §4.6
 * (ECDH-ES), RFC 9052 §3.1 Table 3 (core COSE labels), RFC 9360 (X.509 COSE
 * labels), RFC 9596 (COSE `typ`), plus the lindorm-proprietary `oid`.
 */
export const HEADER_SPECS: ReadonlyArray<HeaderSpec> = [
  {
    domain: "algorithm",
    wire: { jose: wireName("alg"), cose: wireLabel(1, "alg") },
    codec: { kind: "string" },
    provenance: "key",
    direction: BOTH,
    matchable: false,
    sensitivity: "public",
    sample: "ES256",
    // PRUNE: `alg` is REQUIRED (RFC 7515 §4.1.1) and `""` names no algorithm — a
    // missing `alg` wearing a value. Absent is the state `encodeJoseHeader`
    // already refuses by name (`jose-header.ts:19-25`), so pruning routes the
    // failure to the check written for it. `kryptos.algorithm` is a closed union,
    // so aegis's own write cannot reach the cell.
    whenEmpty: "prune",
    placement: "protected",
    critEligible: false,
  },
  // RFC 7518 §4.6.1.2 — ECDH-ES Agreement PartyUInfo (base64url).
  {
    domain: "partyProducer",
    wire: {
      jose: wireName("apu"),
      cose: wireAbsent(
        "ECDH-ES key agreement (RFC 7518 §4.6) has no COSE counterpart on any aegis path: COSE encryption is COSE_Encrypt0 with direct encryption, so no Concat-KDF party info is ever produced.",
      ),
    },
    codec: { kind: "string" },
    provenance: "caller",
    direction: BOTH,
    matchable: false,
    sensitivity: "public",
    sample: "cGFydHktdQ",
    // PRUNE, and RFC 7518 §4.6.2 proves it rather than merely permitting it.
    // PartyUInfo is Concat-KDF input, and the RFC defines the present-but-empty
    // case to compute what the ABSENT case computes: "If an "apu" (agreement
    // PartyUInfo) Header Parameter is present, Data is set to the result of
    // base64url decoding the "apu" value and Datalen is set to the number of
    // octets in Data. Otherwise, Datalen is set to 0 and Data is set to the empty
    // octet sequence." Decoding `""` yields the empty octet sequence and a
    // Datalen of 0 — the two branches agree exactly — so an empty `apu` derives
    // the SAME key an absent one does. It is a header parameter that changes
    // nothing, and aegis never even feeds it in: `resolve-ecdh-party.ts:44`
    // decodes the value only when it is truthy.
    whenEmpty: "prune",
    placement: "protected",
    critEligible: false,
  },
  // RFC 7518 §4.6.1.3 — ECDH-ES Agreement PartyVInfo (base64url).
  {
    domain: "partyRecipient",
    wire: {
      jose: wireName("apv"),
      cose: wireAbsent(
        "ECDH-ES key agreement (RFC 7518 §4.6) has no COSE counterpart on any aegis path: COSE encryption is COSE_Encrypt0 with direct encryption, so no Concat-KDF party info is ever produced.",
      ),
    },
    codec: { kind: "string" },
    provenance: "caller",
    direction: BOTH,
    matchable: false,
    sensitivity: "public",
    sample: "cGFydHktdg",
    // PRUNE: the `apu` argument, for PartyVInfo — RFC 7518 §4.6.2 states the
    // absent/empty equivalence for this parameter in the same words.
    whenEmpty: "prune",
    placement: "protected",
    critEligible: false,
  },
  {
    domain: "critical",
    wire: { jose: wireName("crit"), cose: wireLabel(2, "crit") },
    codec: { kind: "critical" },
    provenance: "caller",
    direction: BOTH,
    matchable: false,
    sensitivity: "public",
    // ⚠ DOMAIN spelling. This entry's own VALUE holds DOMAIN names like every
    // other domain-keyed value here, and `criticalToWire` maps each member
    // domain -> wire (`objectId` -> `oid`) while passing an unrecognised member
    // through unchanged. The sample was `["oid"]` — the WIRE spelling — which
    // therefore survived the write by falling through the passthrough arm and
    // came back from the read as `["objectId"]`, so the one value the column
    // exists to demonstrate did not round-trip to itself.
    sample: ["objectId"],
    // PRUNE, and the only cell where both wires forbid the empty value outright.
    // RFC 7515 §4.1.11: "Producers MUST NOT use the empty list "[]" as the "crit"
    // value." RFC 9052 §3.1: "The array MUST have at least one value in it."
    // aegis's own reader already refuses one (`validate-crit.ts:66-69`), so an
    // empty `crit` that reached the wire was a token aegis minted and would not
    // verify.
    whenEmpty: "prune",
    placement: "protected",
    critEligible: false,
  },
  {
    domain: "contentType",
    wire: { jose: wireName("cty"), cose: wireLabel(3, "cty") },
    codec: { kind: "string" },
    provenance: "caller",
    direction: BOTH,
    matchable: false,
    sensitivity: "public",
    sample: "application/json",
    // PRUNE: `cty` names the payload's media type (RFC 7515 §4.1.10) and `""` is
    // not one. It is worse than noise here: `serialiseContent` prefers it over the
    // inferred type (`content-codec.ts:175`, `??` passes `""` through) and
    // `reconstructStrategy("")` falls to the raw-bytes default
    // (`content-codec.ts:92-114`), so a sealed object came back a Buffer. Absent
    // is the state both aegis and the RFC already define; empty is a second
    // spelling of it, and the one nothing has a rule for.
    whenEmpty: "prune",
    placement: "protected",
    critEligible: false,
  },
  {
    domain: "encryption",
    wire: {
      jose: wireName("enc"),
      cose: wireAbsent(
        "COSE_Encrypt0 carries the content-encryption algorithm in `alg` (label 1) — there is no separate `enc` parameter to relabel.",
      ),
    },
    codec: { kind: "string" },
    // `JweKit.ts` writes it from the kit's own `this.encryption`, never from the
    // caller's bag — the column said `caller` and the code has never agreed.
    provenance: "computed",
    direction: BOTH,
    matchable: false,
    sensitivity: "public",
    sample: "A256GCM",
    // PRUNE: RFC 7516 §4.1.2 makes `enc` REQUIRED on a JWE, and `""` names no
    // content-encryption algorithm — indistinguishable from a header that never
    // had one. Provenance is `computed` from the kit's own `this.encryption`, so
    // aegis's own write cannot reach the cell; it states the direction a smuggled
    // one fails in, and `decodeJoseHeader` refuses an unknown `enc` on the read
    // (`jose-header.ts:99-107`).
    whenEmpty: "prune",
    placement: "protected",
    critEligible: false,
  },
  {
    domain: "publicEncryptionJwk",
    wire: {
      jose: wireName("epk"),
      cose: wireAbsent(
        "The ephemeral public key is an ECDH-ES key-management output; aegis's COSE encryption is direct, so no ephemeral key is produced.",
      ),
    },
    codec: { kind: "jwk" },
    provenance: "computed",
    direction: BOTH,
    matchable: false,
    sensitivity: "public",
    sample: { kty: "EC", crv: "P-256", x: "eHNhbXBsZQ", y: "eXNhbXBsZQ" },
    // PRUNE: RFC 7518 §4.6.1.1 makes `epk` the ephemeral public key "created by
    // the originator", which the recipient agrees against — yielding the CEK
    // directly for `ECDH-ES` and the KEY-WRAPPING key for the `+A*KW` variants
    // (§4.6.2). `{}` carries no `kty`, `crv` or coordinates, so no key agreement
    // can be performed from it — and "no ephemeral key was produced" is exactly
    // what an ABSENT `epk` reports, which is the honest shape of every
    // non-ECDH-ES token aegis writes.
    whenEmpty: "prune",
    placement: "protected",
    critEligible: false,
  },
  {
    domain: "initialisationVector",
    wire: { jose: wireName("iv"), cose: wireLabel(5, "iv") },
    codec: { kind: "buffer" },
    provenance: "computed",
    direction: BOTH,
    matchable: false,
    sensitivity: "public",
    sample: Buffer.alloc(12),
    // PRUNE. ⚠ The cell does NOT govern a zero-length Buffer: `isEmpty` treats a
    // Buffer as non-empty by design (`is-empty.ts:18-21`), and a zero-length nonce
    // is a crypto-layer defect that must fail in the AEAD rather than be pruned
    // into "no IV". What it does govern is the non-Buffer empty the guardless
    // `buffer` arm lets through (`token-header.ts:89-90` applies no guard at all)
    // — `""`, `null`, `{}`, `[]`. None of them is a nonce; an AEAD nonce is bytes
    // or absent.
    whenEmpty: "prune",
    // JOSE carries it on the protected header; COSE_Encrypt0 puts it in the
    // unprotected bucket (it is an AEAD input, not integrity-protected data).
    placement: "either",
    critEligible: false,
  },
  {
    domain: "jwksUri",
    wire: {
      jose: wireName("jku"),
      cose: wireAbsent(
        "aegis never trusts a header-embedded key SOURCE on any wire, and no COSE header parameter is mapped for one.",
      ),
    },
    codec: { kind: "url" },
    provenance: "caller",
    direction: BOTH,
    matchable: false,
    sensitivity: "public",
    sample: "https://issuer.lindorm.test/.well-known/jwks.json",
    // PRUNE, and no empty value can reach the cell: `isUrlLike("")` is false, so
    // the codec guard (`token-header.ts:83-84`) already drops every empty form. The
    // cell records the same answer at the bag level rather than leaving this the
    // one row with no verdict.
    whenEmpty: "prune",
    placement: "protected",
    critEligible: false,
  },
  {
    domain: "jwk",
    wire: {
      jose: wireName("jwk"),
      cose: wireAbsent(
        "aegis never trusts a header-embedded KEY on any wire, and no COSE header parameter is mapped for one.",
      ),
    },
    codec: { kind: "jwk" },
    provenance: "caller",
    direction: BOTH,
    matchable: false,
    sensitivity: "public",
    sample: { kty: "EC", crv: "P-256", x: "eHNhbXBsZQ", y: "eXNhbXBsZQ" },
    // PRUNE: `{}` is a JWK with no `kty`, which RFC 7517 §4.1 makes REQUIRED — it
    // identifies no key. aegis never trusts a header-embedded key on any wire
    // (stated on this entry's COSE absence), so an empty one is noise no recipient
    // can act on.
    whenEmpty: "prune",
    placement: "protected",
    critEligible: false,
  },
  {
    domain: "keyId",
    wire: { jose: wireName("kid"), cose: wireLabel(4, "kid") },
    codec: { kind: "string" },
    provenance: "key",
    direction: BOTH,
    matchable: false,
    sensitivity: "public",
    sample: "key_sample",
    // PRUNE: `kid` is the lookup hint a verifier resolves the key by, and `""`
    // matches nothing — indistinguishable from a token that gave no hint.
    // `encodeJoseHeader` already refuses a falsy `kid` (`jose-header.ts:42-49`).
    // On COSE it also travels unprotected (`placement: "either"`), where an empty
    // one would be a routing hint that routes nowhere.
    whenEmpty: "prune",
    // COSE convention: kid is an advisory routing hint read BEFORE the signature
    // is checked, so the COSE kits emit it unprotected; JOSE has one header.
    placement: "either",
    critEligible: false,
  },
  // `oid` (lindorm object id) has no IANA COSE label, so it rides COSE under a
  // lindorm PRIVATE-USE header-parameter label — RFC 8152 §16.2, the registry
  // RFC 9052 §11.1 re-points: "Integer values less than -65536 are marked as
  // private use." Chosen well clear of the private-use CLAIM/enc label band
  // (-65537…) so a grep never confuses a header label with a claim/enc label.
  //
  // ⚠ A private-use label is UNINTERPRETABLE to a foreign reader, so it is only
  // written as an integer when the caller asks for the proprietary spelling; the
  // interoperable default emits the string label `"oid"` instead. That choice is
  // `coseWireKey` below, gated on the RANGE and never on this name.
  {
    domain: "objectId",
    wire: { jose: wireName("oid"), cose: wireLabel(-70000, "oid") },
    codec: { kind: "string" },
    provenance: "caller",
    direction: BOTH,
    matchable: false,
    sensitivity: "public",
    sample: "oid_sample",
    // PRUNE: `oid` names the domain object the token is about; `""` names none,
    // and nothing in aegis or on the platform reads an empty object id as anything
    // but "not stated".
    whenEmpty: "prune",
    placement: "protected",
    // ⭐ THE ONE ELIGIBLE PARAMETER — the only name a caller may put in `crit`
    // and the only name a verify accepts there. RFC 7515 §4.1.11: "Producers
    // MUST NOT include Header Parameter names defined by this specification or
    // [JWA] for use with JWS […] in the "crit" list." `oid` is the sole parameter
    // aegis owns that neither document defines; the other twenty JOSE names here
    // are IANA-registered JOSE header parameters, so `crit` may not name them and
    // every one of them is `false`.
    //
    // ⚠ WHAT "AEGIS IMPLEMENTS IT" MEANS, said out loud because RFC 7515
    // §4.1.11's own phrase — "understood and supported by the recipient" — reads
    // stronger than what any library can provide for this parameter. It is AEGIS
    // POLICY and not a reading of the RFC: aegis holds a registry entry for
    // `oid`, translates it in BOTH directions on BOTH wires, placement-checks it,
    // and REPORTS its value on the verified domain header as `objectId`. It does
    // not act on the value, and no library could — the object identifier belongs
    // to the deployment. So a producer marking it critical is asserting that the
    // RECIPIENT'S OWN code reads `header.objectId` before acting on the token,
    // and aegis's part of that bargain is to deliver it rather than to interpret
    // it. That is interoperable aegis-to-aegis, which is a real deployment, and
    // is why this is an extension rather than a dead header parameter.
    critEligible: true,
  },
  {
    domain: "pbkdfIterations",
    wire: {
      jose: wireName("p2c"),
      cose: wireAbsent(
        "PBES2 (RFC 7518 §4.8) is a JWE key-management algorithm; aegis's COSE encryption is direct, so no password-derived key is produced.",
      ),
    },
    codec: { kind: "number" },
    // The PBES2 iteration count `JweKit.ts` reads back off the key-management
    // output, beside the `p2s` salt that has always been declared `computed`.
    provenance: "computed",
    direction: BOTH,
    matchable: false,
    sensitivity: "public",
    sample: 310000,
    // PRUNE, and no empty value exists for it to act on: `isEmpty` is false for
    // every number (`is-empty.ts:30`) and `isFinite` rejects every non-number
    // (`token-header.ts:85-86`). ⚠ `p2c: 0` is a VALUE, not an absence, and is never
    // pruned — a zero iteration count is a key-management defect that must fail
    // where the derivation happens, not vanish from the header a recipient needs
    // to reproduce it (RFC 7518 §4.8.1.2).
    whenEmpty: "prune",
    placement: "protected",
    critEligible: false,
  },
  {
    domain: "pbkdfSalt",
    wire: {
      jose: wireName("p2s"),
      cose: wireAbsent(
        "PBES2 (RFC 7518 §4.8) is a JWE key-management algorithm; aegis's COSE encryption is direct, so no password-derived key is produced.",
      ),
    },
    codec: { kind: "buffer" },
    provenance: "computed",
    direction: BOTH,
    matchable: false,
    sensitivity: "public",
    sample: Buffer.alloc(16),
    // PRUNE, on the `iv` argument — and with the same ⚠: a zero-length Buffer is
    // not empty and is not governed here.
    whenEmpty: "prune",
    placement: "protected",
    critEligible: false,
  },
  {
    domain: "publicEncryptionTag",
    wire: {
      jose: wireName("tag"),
      cose: wireAbsent(
        "The key-wrap authentication tag is an AES-GCM-KW key-management output; aegis's COSE encryption is direct, so no key is wrapped.",
      ),
    },
    codec: { kind: "buffer" },
    provenance: "computed",
    direction: BOTH,
    matchable: false,
    sensitivity: "public",
    sample: Buffer.alloc(16),
    // PRUNE, on the `iv` argument. The key-wrap authentication tag is bytes or
    // absent; the non-Buffer empties the guardless `buffer` arm admits are neither.
    whenEmpty: "prune",
    placement: "protected",
    critEligible: false,
  },
  {
    domain: "headerType",
    wire: { jose: wireName("typ"), cose: wireLabel(16, "typ") }, // RFC 9596 §4.1
    codec: { kind: "string" },
    // Every kit builds the full media type itself from the `tokenType` PREFIX
    // (`buildMediaType`/`computeTypHeader`). A caller supplies the prefix, never
    // the parameter — which is why every row reserves it.
    provenance: "computed",
    direction: BOTH,
    matchable: false,
    sensitivity: "public",
    // The FULL media type. RFC 7519 §5.1 permits the `application/` prefix to be
    // omitted on the wire, but the DOMAIN column reports what aegis reads back —
    // and aegis always writes and reports the complete media type — so the bare
    // `"at+jwt"` this held could never round-trip to itself.
    sample: "application/at+jwt",
    // PRUNE: `typ` declares the type of the complete object, and ROUTING ON IT IS
    // AEGIS POLICY rather than a library requirement — RFC 9596 §2 has `typ`
    // "ignored by COSE implementations […] other than being passed through to
    // applications using those implementations", and aegis is the application.
    // `assertWireTyp` gates every read on it, so `""` would leave the token
    // unroutable while looking declared. RFC 7515 §4.1.9 makes ABSENT a defined
    // state; empty is not one.
    // `buildMediaType` never returns `""` (`compute-typ-header.ts:47-49` floors an
    // empty prefix to the bare conventional form) and `encodeJoseHeader` refuses a
    // falsy `typ` (`jose-header.ts:35-41`), so aegis's own write cannot reach the
    // cell.
    whenEmpty: "prune",
    placement: "protected",
    critEligible: false,
  },
  {
    domain: "certificateChain",
    wire: { jose: wireName("x5c"), cose: wireLabel(33, "x5c") }, // RFC 9360 x5chain
    codec: { kind: "array" },
    provenance: "key",
    direction: BOTH,
    matchable: false,
    sensitivity: "public",
    sample: ["MIIBsample"],
    // PRUNE. ⚠ NOT a restriction, and this is where it splits from `x5t#S256`
    // below: nothing reads `x5c` — the binding check consults the SHA-256
    // thumbprint alone (`verify-cert-binding.ts:7,38`) — so an empty chain
    // restricts nothing and pruning removes nothing. RFC 7515 §4.1.6 makes the
    // first member the certificate corresponding to the key, and a chain with no
    // members corresponds to no key. `resolve-cert-binding.ts:44-45` already
    // refuses to emit one, so the writer has made the same call.
    whenEmpty: "prune",
    placement: "protected",
    critEligible: false,
  },
  // RFC 7515 §4.1.7 — X.509 certificate SHA-1 thumbprint (base64url). Kit-derived
  // from the signing/encrypting kryptos (like `x5t#S256`), auto-emitted whenever a
  // cert is bound; the write side gates it behind a boolean, the read side never
  // verifies it.
  {
    domain: "certificateThumbprintSha1",
    wire: {
      jose: wireName("x5t"),
      cose: wireAbsent(
        "COSE's x5t (label 34, RFC 9360) is a COSE_CertHash structure `[algId, hashValue]`, NOT a plain relabel of JOSE's base64url thumbprint. Leaving it unmapped means a foreign COSE token's x5t is SKIPPED on decode rather than silently mis-shaped into a bogus string.",
      ),
    },
    codec: { kind: "string" },
    provenance: "key",
    direction: BOTH,
    matchable: false,
    sensitivity: "public",
    sample: "dGh1bWJwcmludC1zaGEx",
    // PRUNE, and the split from `x5t#S256` is the whole reason the two cells
    // differ: aegis binds on the SHA-256 thumbprint ALONE and never verifies this
    // one (`verify-cert-binding.ts:19-21`). It is legacy-compat output, so an
    // empty value binds nothing, is refused by nothing, and is pure noise on the
    // wire.
    whenEmpty: "prune",
    placement: "protected",
    critEligible: false,
  },
  {
    domain: "certificateThumbprint",
    wire: {
      jose: wireName("x5t#S256"),
      cose: wireAbsent(
        "COSE's x5t (label 34, RFC 9360) is a COSE_CertHash structure `[algId, hashValue]`, NOT a plain relabel of JOSE's base64url thumbprint; the hash algorithm is a member of the structure rather than part of the parameter name.",
      ),
    },
    codec: { kind: "string" },
    provenance: "key",
    direction: BOTH,
    matchable: false,
    sensitivity: "public",
    sample: "dGh1bWJwcmludC1zaGEyNTY",
    // REFUSE: `x5t#S256` is the ONE header parameter aegis's verify ENFORCES —
    // `verify-cert-binding.ts` skips the check when it is absent and refuses a
    // mismatch when it is present, so PRESENCE IS THE BINDING. That leaves an
    // empty value with no disposal at all, which is why this is the one cell that
    // is neither `prune` nor `keep`: pruning converts an unsatisfiable binding
    // into NO binding and hands the audience an unbound token (the `cnf`
    // fail-open in header form), while keeping emits a token whose binding no
    // certificate can ever satisfy — one every conformant recipient rejects. The
    // WRITE is the only place left where the producer still holds the value and
    // can either supply it or drop the parameter, so the write throws
    // (`refuse-empty-headers.ts`).
    //
    // ⚠ It is a BOUNDARY guard, not a repair of an aegis path. Provenance is
    // `key`, both caller-facing header types Omit the parameter, and
    // `resolveCertBinding` reads it off a kryptos that answers `null` or a real
    // digest — so the one producer of `""` is a foreign `IKryptos`, an interface
    // aegis publishes and does not implement.
    //
    // ⚠ Do NOT generalise it to the other two cert parameters. It holds because
    // something READS the value and treats presence as a binding; nothing reads
    // `x5t` or `x5c`, and both of them prune.
    whenEmpty: "refuse",
    placement: "protected",
    critEligible: false,
  },
  // RFC 7515 §4.1.5 — X.509 URL. COSE label 35 (RFC 9360 x5u).
  {
    domain: "certificateUrl",
    wire: { jose: wireName("x5u"), cose: wireLabel(35, "x5u") },
    codec: { kind: "string" },
    provenance: "caller",
    direction: BOTH,
    matchable: false,
    sensitivity: "public",
    sample: "https://issuer.lindorm.test/certs.pem",
    // PRUNE: RFC 7515 §4.1.5 makes `x5u` a URI, and `""` is not one. ⚠ Note this
    // row carries the `string` codec, not `url` like `jku` — so unlike `jku` the
    // guard does NOT already drop an empty value, and this cell is what stops it.
    whenEmpty: "prune",
    placement: "protected",
    critEligible: false,
  },
  // RFC 7516 §4.1.3 — compression algorithm ("DEF" is the only registered value).
  {
    domain: "zip",
    wire: {
      jose: wireName("zip"),
      cose: wireAbsent(
        "COSE registers no compression header parameter, and aegis compresses nothing on the COSE wire.",
      ),
    },
    codec: { kind: "string" },
    provenance: "caller",
    direction: BOTH,
    matchable: false,
    sensitivity: "public",
    sample: "DEF",
    // PRUNE: RFC 7516 §4.1.3 DEFINES "DEF" as the one compression algorithm value
    // that specification gives (the IANA registration is RFC 7518 §7.3 / §7.3.2);
    // `""` names none. aegis compresses nothing on any write path, so an empty `zip`
    // declares a transform that did not happen — on a token `JweKit.decrypt` then
    // refuses for merely CARRYING the parameter (`JweKit.ts:174-182`). The refusal for
    // a FOREIGN token's `zip` is untouched: the read path is not normalised.
    whenEmpty: "prune",
    placement: "protected",
    critEligible: false,
  },
];

/**
 * The header registry. `unregistered: "drop"` states ONCE what makes the header
 * side different from the claim side: headers are a CLOSED set, so a key with no
 * entry is dropped in BOTH directions (`token-header.ts`) rather than carried
 * through as a custom parameter.
 */
export const HEADER_REGISTRY: Registry<HeaderSpec> = {
  specs: HEADER_SPECS,
  unregistered: "drop",
};

/** The JOSE wire name. Every header parameter rides JOSE, so it is always defined. */
export const headerJoseName = (spec: HeaderSpec): string => {
  const name = wireKeyName(spec.wire.jose);

  if (name === undefined) {
    throw new Error(`Header parameter "${spec.domain}" has no jose wire name`);
  }

  return name;
};

/** The COSE integer label, or `undefined` where COSE does not carry the parameter. */
export const headerCoseLabel = (spec: HeaderSpec): number | undefined =>
  wireKeyLabel(spec.wire.cose);

const byJose = new Map<string, HeaderSpec>(
  HEADER_SPECS.map((spec) => [headerJoseName(spec), spec]),
);
const byDomain = new Map<string, HeaderSpec>(
  HEADER_SPECS.map((spec) => [spec.domain, spec]),
);
// Integer COSE label -> spec. Only entries carrying a label are keyed; parameters
// COSE has no plain integer label for are absent.
const byCose = new Map<number, HeaderSpec>(
  HEADER_SPECS.flatMap((spec) => {
    const label = headerCoseLabel(spec);
    return label === undefined ? [] : [[label, spec] as const];
  }),
);
/**
 * COSE TEXT label -> spec, and deliberately NOT one entry per parameter: only the
 * parameters that can legitimately BE string-keyed on the COSE wire are here —
 * a `name`-keyed one (none today), and a PRIVATE-USE label, whose string spelling
 * is what the interoperable default emits.
 *
 * ⚠ The same {@link isPrivateUseLabel} the write side gates on, which is what
 * keeps the two spellings a single fact. A blanket "any label may also arrive as
 * its name" would let a foreign token deliver `typ` or `cty` under a text label
 * aegis never writes, i.e. a second spelling for a registered parameter that no
 * specification gives it.
 */
const byCoseName = new Map<string, HeaderSpec>(
  HEADER_SPECS.flatMap((spec) => {
    const key = spec.wire.cose;

    if (key.kind === "absent") return [];
    if (key.kind === "label" && !isPrivateUseLabel(key.label)) return [];

    return [[key.name, spec] as const];
  }),
);

/** Resolve a header spec by its JOSE wire name (or `undefined` if unregistered). */
export const headerByJose = (jose: string): HeaderSpec | undefined => byJose.get(jose);

/** Resolve a header spec by its domain name (or `undefined` if unregistered). */
export const headerByDomain = (domain: string): HeaderSpec | undefined =>
  byDomain.get(domain);

/** Resolve a header spec by its integer COSE label (or `undefined` if none). */
export const headerByCose = (label: number): HeaderSpec | undefined => byCose.get(label);

/**
 * The JOSE wire name for a COSE label, or `undefined` if COSE carries no
 * registered parameter under it. The COSE read paths translate labels back to
 * JOSE names, which is the vocabulary the domain layer speaks.
 *
 * ⚠ It takes a {@link CoseLabel}, not an integer, because RFC 9052 §1.5 makes a
 * text label a label too — and the interoperable default WRITES one for every
 * private-use parameter. A token minted either way must therefore read back to
 * the same domain header, so this is the READ half of `coseWireKey`: an integer
 * resolves through the label table, a string through the text-label table, and
 * neither table answers for the other.
 */
export const joseByCose = (label: CoseLabel): string | undefined => {
  const spec = isNumber(label) ? byCose.get(label) : byCoseName.get(label);

  return spec ? headerJoseName(spec) : undefined;
};

/** The refusal both COSE resolvers give for a parameter COSE does not carry. */
const noCoseLabel = (jose: string, spec: HeaderSpec | undefined): CoseError =>
  new CoseError("No COSE label for header parameter", {
    code: "header_no_cose_label",
    data: {
      jose,
      reason: spec?.wire.cose.kind === "absent" ? spec.wire.cose.reason : undefined,
    },
    title: "No COSE Label For Header Parameter",
    details:
      "The header registry has no COSE integer label for this JOSE wire parameter; COSE either omits it or represents it with a non-integer structure.",
  });

/**
 * The COSE INTEGER header label for a JOSE wire parameter. THROWS if COSE does
 * not carry the parameter, reporting the registry's stated `reason`, which is the
 * drift guard against a caller asking for a label that does not exist.
 *
 * ⚠ NOT the writer's resolver — that is {@link coseWireKey}. This answers the
 * narrower question "which integer is this parameter registered at", which is
 * what the READ paths need to look a decoded label up (`CweKit`'s `iv`,
 * `decode-cwt`'s `kid`/`alg`/`typ`) and what the derived-parameter tables are
 * keyed by. A writer that reaches for it instead would put a private-use integer
 * on an interoperable wire.
 */
export const coseByJose = (jose: string): number => {
  const spec = byJose.get(jose);
  const label = spec ? headerCoseLabel(spec) : undefined;

  if (label === undefined) throw noCoseLabel(jose, spec);

  return label;
};

/**
 * THE WRITER'S RESOLVER: the COSE label a parameter is spelled by on the wire,
 * in the interop mode the caller asked for. Every COSE write path resolves
 * through this and nothing else, so a parameter, a `crit` member naming it and
 * the reserved-parameter guard all agree on one spelling.
 *
 * RFC 9052 §1.5 defines `label = int / tstr`, so a text label is a label — which
 * is what makes the interoperable answer possible at all:
 *
 *   - a REGISTERED integer label is interoperable as it stands, so it is written
 *     as the integer in both modes;
 *   - a PRIVATE-USE integer label ({@link isPrivateUseLabel}) means nothing to a
 *     foreign reader, so `proprietary: false` — the default — writes the
 *     parameter's string label instead. Nothing is dropped and nothing is
 *     renamed; only the encoding of the key changes.
 *   - `proprietary: true` is the on-platform token: the compact private-use
 *     integer, which is the shorter encoding and the one aegis reads either way.
 *
 * That is the header twin of the promise `EncodeCwtOptions` already kept for
 * claims — a token minted with the default carries nothing a conformant COSE
 * reader cannot interpret.
 *
 * THROWS for a parameter COSE does not carry, exactly as {@link coseByJose} does
 * and with the same verdict: a caller naming one must hear so.
 */
export const coseWireKey = (
  jose: string,
  proprietary: boolean | undefined,
): CoseLabel => {
  const spec = byJose.get(jose);

  if (spec === undefined) throw noCoseLabel(jose, spec);

  const key = spec.wire.cose;

  switch (key.kind) {
    case "absent":
      throw noCoseLabel(jose, spec);
    // A parameter COSE keys by its NAME is already the string on every wire; the
    // interop mode has nothing to choose. None today — the registry's `name` cells
    // are all interop fallbacks for a label — but `WireKey` declares the case, so
    // the resolver answers it rather than casting it away.
    case "name":
      return key.name;
    case "label":
      return proprietary === true || !isPrivateUseLabel(key.label) ? key.label : key.name;
    default: {
      // `noImplicitReturns` is off repo-wide: without this a new `WireKey` member
      // would silently resolve to `undefined` and the parameter would be written
      // under an undefined label rather than failing the build.
      const exhaustive: never = key;
      throw new CoseError("Unhandled COSE wire key kind", {
        code: "header_unhandled_wire_key_kind",
        data: { jose, kind: String((exhaustive as { kind?: unknown }).kind) },
        title: "Unhandled COSE Wire Key Kind",
        details:
          "The header registry declares a COSE wire key kind the resolver does not handle, so the parameter has no spelling on the COSE wire.",
      });
    }
  }
};
