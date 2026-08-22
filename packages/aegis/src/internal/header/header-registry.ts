/**
 * The single header registry: the one place that maps each JOSE protected header
 * parameter to its aegis DOMAIN name, its spelling on EVERY wire, how its value is
 * shaped, and where it comes from. It is the header-side twin of
 * `internal/claims/claims-registry.ts` and shares the {@link ParamSpec} base.
 *
 * `token-header.ts` is DATA-DRIVEN: it iterates the actual header data and looks
 * each key up here. The drift-guard test binds the domain names to
 * `DomainTokenHeader` and the JOSE names to `WireTokenHeader`, so a rename on
 * either side fails the build. `internal/cose/*` resolves its integer labels
 * through `coseByJose`.
 *
 * --- `absent` is a STATED fact ---
 *
 * A parameter with no COSE form carries a required `reason` on its `absent` wire
 * key, which `coseByJose` reports when it refuses; an optional field would be
 * indistinguishable from an oversight. The `cose` codec cell is `null` on exactly
 * those rows, bound to the `absent` cell in `header-registry.test.ts`.
 *
 * --- `sensitivity` ---
 *
 * A header parameter is never encrypted content, so every row is `public`. It is
 * declared per entry anyway, so the first parameter that breaks the pattern has to
 * say so here.
 *
 * --- `critEligible` ---
 *
 * WRITE-SIDE ONLY: `internal/header/is-crit-eligible.ts` is its one reader,
 * serving the mint gate `assert-crit-eligible.ts`. The verify gate reads the
 * registry too, but never this cell — the read rule is stated once, on
 * `internal/utils/reject-unknown-critical.ts`. So this cell decides whether a
 * PRODUCER may name a REGISTERED parameter, and nothing else.
 *
 * --- `whenEmpty` ---
 *
 * REQUIRED on every entry with no default: each verdict fails open in a different
 * direction. The one `refuse` is `x5t#S256`, where presence IS the binding, so an
 * empty value can be neither dropped (an unbound token) nor carried (a token no
 * certificate satisfies).
 *
 * ⚠ `keep` HAS NO HEADER USERS and is not dead — claims hold it
 * (`internal/claims/claims-registry.ts`), which is why the union is not narrowed
 * here. A `keep` needs an empty value a RECIPIENT can act on, and no header
 * parameter has one.
 */

import { isNumber } from "@lindorm/is";
import { CoseError } from "../../errors/index.js";
import type { CoseLabel } from "../cose/cose-label.js";
import type { CoseHeaderCodec } from "../registry/cose-header-codec.js";
import type { HeaderSpec } from "../registry/header-spec.js";
import { isPrivateUseLabel } from "../registry/is-private-use-label.js";
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
export type { CoseHeaderCodec } from "../registry/cose-header-codec.js";

/**
 * The registry. Ordered alphabetically by JOSE name for readability only — the
 * codec reads neither position nor any subset. Lookups derive from the Maps below.
 *
 * RFC 7515 §4.1 · RFC 7516 §4.1 · RFC 7518 §4.6 · RFC 9052 §3.1 · RFC 9360 §2 ·
 * RFC 9596 §2, plus the lindorm-proprietary `oid`.
 */
export const HEADER_SPECS: ReadonlyArray<HeaderSpec> = [
  {
    domain: "algorithm",
    spec: {
      kind: "rfc",
      rfc: "RFC 7515",
      section: "4.1.1",
      url: "https://www.rfc-editor.org/rfc/rfc7515#section-4.1.1",
    },
    wire: { jose: wireName("alg"), cose: wireLabel(1, "alg") },
    codec: { kind: "string" },
    cose: { kind: "algorithmLabel" },
    sensitivity: "public",
    sample: "ES256",
    // PRUNE: `""` names no algorithm — a missing `alg` wearing a value, and absent
    // is the state `encodeJoseHeader` already refuses by name. `kryptos.algorithm`
    // is a closed union, so aegis's own write cannot reach the cell.
    whenEmpty: "prune",
    placement: "protected",
    critEligible: false,
  },
  // RFC 7518 §4.6.1.2 — ECDH-ES Agreement PartyUInfo (base64url).
  {
    domain: "partyProducer",
    spec: {
      kind: "rfc",
      rfc: "RFC 7518",
      section: "4.6.1.2",
      url: "https://www.rfc-editor.org/rfc/rfc7518#section-4.6.1.2",
    },
    wire: {
      jose: wireName("apu"),
      cose: wireAbsent(
        "ECDH-ES key agreement (RFC 7518 §4.6) has no COSE counterpart on any aegis path: a COSE_Encrypt0 carries no recipients array and runs no key-agreement step, so no Concat-KDF party info is produced.",
      ),
    },
    codec: { kind: "string" },
    cose: null,
    sensitivity: "public",
    sample: "cGFydHktdQ",
    // PRUNE: an empty `apu` derives the SAME key an absent one does (RFC 7518
    // §4.6.2), so it is a header parameter that changes nothing — and
    // `resolve-ecdh-party.ts` decodes the value only when it is truthy.
    whenEmpty: "prune",
    placement: "protected",
    critEligible: false,
  },
  // RFC 7518 §4.6.1.3 — ECDH-ES Agreement PartyVInfo (base64url).
  {
    domain: "partyRecipient",
    spec: {
      kind: "rfc",
      rfc: "RFC 7518",
      section: "4.6.1.3",
      url: "https://www.rfc-editor.org/rfc/rfc7518#section-4.6.1.3",
    },
    wire: {
      jose: wireName("apv"),
      cose: wireAbsent(
        "ECDH-ES key agreement (RFC 7518 §4.6) has no COSE counterpart on any aegis path: a COSE_Encrypt0 carries no recipients array and runs no key-agreement step, so no Concat-KDF party info is produced.",
      ),
    },
    codec: { kind: "string" },
    cose: null,
    sensitivity: "public",
    sample: "cGFydHktdg",
    // PRUNE: the `apu` argument, for PartyVInfo (RFC 7518 §4.6.2).
    whenEmpty: "prune",
    placement: "protected",
    critEligible: false,
  },
  {
    domain: "critical",
    spec: {
      kind: "rfc",
      rfc: "RFC 7515",
      section: "4.1.11",
      url: "https://www.rfc-editor.org/rfc/rfc7515#section-4.1.11",
    },
    wire: { jose: wireName("crit"), cose: wireLabel(2, "crit") },
    codec: { kind: "critical" },
    cose: { kind: "critical" },
    sensitivity: "public",
    // ⚠ DOMAIN spelling. `criticalToWire` maps each member domain -> wire
    // (`objectId` -> `oid`) and passes an unrecognised member through unchanged, so
    // a WIRE spelling here would survive the write and read back as the domain one.
    sample: ["objectId"],
    // PRUNE, and the only cell both wires forbid the empty value on outright
    // (RFC 7515 §4.1.11, RFC 9052 §3.1). aegis's own reader refuses one
    // (`validate-crit.ts`), so an empty `crit` on the wire is a token aegis minted
    // and would not verify.
    whenEmpty: "prune",
    placement: "protected",
    critEligible: false,
  },
  {
    domain: "contentType",
    spec: {
      kind: "rfc",
      rfc: "RFC 7515",
      section: "4.1.10",
      url: "https://www.rfc-editor.org/rfc/rfc7515#section-4.1.10",
    },
    wire: { jose: wireName("cty"), cose: wireLabel(3, "cty") },
    codec: { kind: "string" },
    cose: { kind: "passthrough" },
    sensitivity: "public",
    sample: "application/json",
    // PRUNE: `""` is not a media type, and it is worse than noise —
    // `serialiseContent` prefers it over the inferred type (`??` passes `""`
    // through) and `reconstructStrategy("")` falls to the raw-bytes default
    // (`content-codec.ts`), so a sealed object comes back a Buffer.
    whenEmpty: "prune",
    placement: "protected",
    critEligible: false,
  },
  {
    domain: "encryption",
    spec: {
      kind: "rfc",
      rfc: "RFC 7516",
      section: "4.1.2",
      url: "https://www.rfc-editor.org/rfc/rfc7516#section-4.1.2",
    },
    wire: {
      jose: wireName("enc"),
      cose: wireAbsent(
        "COSE_Encrypt0 carries the content-encryption algorithm in `alg` (label 1) — there is no separate `enc` parameter to relabel.",
      ),
    },
    codec: { kind: "string" },
    cose: null,
    sensitivity: "public",
    sample: "A256GCM",
    // PRUNE: `""` names no content-encryption algorithm, and is indistinguishable
    // from a header that never had one. `JweKit` writes it from the kit's own
    // `this.encryption` and never from the caller's bag, so aegis's own write cannot
    // reach the cell; `decodeJoseHeader` refuses an unknown `enc` on the read.
    whenEmpty: "prune",
    placement: "protected",
    critEligible: false,
  },
  {
    domain: "publicEncryptionJwk",
    spec: {
      kind: "rfc",
      rfc: "RFC 7518",
      section: "4.6.1.1",
      url: "https://www.rfc-editor.org/rfc/rfc7518#section-4.6.1.1",
    },
    wire: {
      jose: wireName("epk"),
      cose: wireAbsent(
        "The ephemeral public key is an ECDH-ES key-management output; a COSE_Encrypt0 runs no recipient algorithm, so no ephemeral key is produced.",
      ),
    },
    codec: { kind: "jwk" },
    cose: null,
    sensitivity: "public",
    sample: { kty: "EC", crv: "P-256", x: "eHNhbXBsZQ", y: "eXNhbXBsZQ" },
    // PRUNE: `{}` carries no `kty`, `crv` or coordinates, so no key agreement can
    // be performed from it — and an ABSENT `epk` already reports "no ephemeral key
    // was produced", the shape of every non-ECDH-ES token aegis writes.
    whenEmpty: "prune",
    placement: "protected",
    critEligible: false,
  },
  {
    domain: "initialisationVector",
    spec: {
      kind: "rfc",
      rfc: "RFC 7518",
      section: "4.7.1.1",
      url: "https://www.rfc-editor.org/rfc/rfc7518#section-4.7.1.1",
    },
    wire: { jose: wireName("iv"), cose: wireLabel(5, "iv") },
    codec: { kind: "buffer" },
    cose: { kind: "base64Bytes" },
    sensitivity: "public",
    sample: Buffer.alloc(12),
    // PRUNE. ⚠ It does NOT govern a zero-length Buffer: `isEmpty` treats a Buffer
    // as non-empty, and a zero-length nonce must fail in the AEAD rather than be
    // pruned into "no IV". What it governs is the non-Buffer empty the guardless
    // `buffer` arm lets through (`token-header.ts`) — `""`, `null`, `{}`, `[]`.
    whenEmpty: "prune",
    // JOSE carries it on the protected header; a COSE_Encrypt0 puts it in the
    // unprotected bucket (RFC 9052 §3.1).
    placement: "either",
    critEligible: false,
  },
  {
    domain: "jwksUri",
    spec: {
      kind: "rfc",
      rfc: "RFC 7515",
      section: "4.1.2",
      url: "https://www.rfc-editor.org/rfc/rfc7515#section-4.1.2",
    },
    wire: {
      jose: wireName("jku"),
      cose: wireAbsent(
        "aegis never trusts a header-embedded key SOURCE on any wire, and no COSE header parameter is mapped for one.",
      ),
    },
    codec: { kind: "url" },
    cose: null,
    sensitivity: "public",
    sample: "https://issuer.lindorm.test/.well-known/jwks.json",
    // PRUNE, and no empty value can reach the cell: `isUrlLike("")` is false, so the
    // codec guard (`token-header.ts`) already drops every empty form.
    whenEmpty: "prune",
    placement: "protected",
    critEligible: false,
  },
  {
    domain: "jwk",
    spec: {
      kind: "rfc",
      rfc: "RFC 7515",
      section: "4.1.3",
      url: "https://www.rfc-editor.org/rfc/rfc7515#section-4.1.3",
    },
    wire: {
      jose: wireName("jwk"),
      cose: wireAbsent(
        "aegis never trusts a header-embedded KEY on any wire, and no COSE header parameter is mapped for one.",
      ),
    },
    codec: { kind: "jwk" },
    cose: null,
    sensitivity: "public",
    sample: { kty: "EC", crv: "P-256", x: "eHNhbXBsZQ", y: "eXNhbXBsZQ" },
    // PRUNE: `{}` is a JWK with no `kty` (RFC 7517 §4.1) and identifies no key.
    // aegis never trusts a header-embedded key on any wire, so an empty one is
    // noise no recipient can act on.
    whenEmpty: "prune",
    placement: "protected",
    critEligible: false,
  },
  {
    domain: "keyId",
    spec: {
      kind: "rfc",
      rfc: "RFC 7515",
      section: "4.1.4",
      url: "https://www.rfc-editor.org/rfc/rfc7515#section-4.1.4",
    },
    wire: { jose: wireName("kid"), cose: wireLabel(4, "kid") },
    codec: { kind: "string" },
    cose: { kind: "textBytes" },
    sensitivity: "public",
    sample: "key_sample",
    // PRUNE: `""` matches nothing and is indistinguishable from a token that gave
    // no hint; `encodeJoseHeader` already refuses a falsy `kid`. On COSE it also
    // travels unprotected, where an empty one routes nowhere.
    whenEmpty: "prune",
    // An advisory routing hint read BEFORE the signature is checked, so the COSE
    // kits emit it unprotected (RFC 9052 §3.1); JOSE has one header.
    placement: "either",
    critEligible: false,
  },
  // `oid` (lindorm object id) has no IANA COSE label, so it rides COSE under a
  // lindorm PRIVATE-USE header-parameter label (the range: RFC 8152 §16.2). Chosen
  // well clear of the private-use CLAIM/enc label band so a grep never confuses a
  // header label with a claim/enc label.
  //
  // ⚠ A private-use label is UNINTERPRETABLE to a foreign reader, so it is written
  // as an integer only when the caller asks for the proprietary spelling; the
  // interoperable default emits the string label `"oid"`. That choice is
  // `coseWireKey` below, gated on the RANGE and never on this name.
  {
    domain: "objectId",
    spec: {
      kind: "policy",
      why: "lindorm's own object id; no specification registers an `oid` header parameter, which is why it is the one crit-eligible row.",
    },
    wire: { jose: wireName("oid"), cose: wireLabel(-70000, "oid") },
    codec: { kind: "string" },
    cose: { kind: "passthrough" },
    sensitivity: "public",
    sample: "oid_sample",
    // PRUNE: `""` names no object, and nothing reads an empty object id as anything
    // but "not stated".
    whenEmpty: "prune",
    placement: "protected",
    // ⭐ THE ONE ELIGIBLE REGISTERED PARAMETER — the only name in THIS REGISTRY a
    // caller may put in `crit`, because it is the sole parameter aegis owns that no
    // specification defines (RFC 7515 §4.1.11).
    //
    // ⛔ IT IS NOT THE ONLY NAME A `crit` MAY CARRY, and it is a WRITE-side column.
    // The MINT gate ORs it with the keys of the custom bag the same call writes
    // (`internal/header/assert-crit-eligible.ts`). The READ gate does not consult
    // this column at all — that rule is stated once, on
    // `internal/utils/reject-unknown-critical.ts`.
    //
    // ⚠ MARKING IT CRITICAL IS AEGIS POLICY, not a reading of the RFC. aegis
    // translates `oid` on both wires and REPORTS it as `objectId`; it does not act
    // on the value, because the object identifier belongs to the deployment. A
    // producer marking it critical is asserting that the RECIPIENT'S OWN code reads
    // `header.objectId` — aegis's part is to deliver it, not to interpret it.
    critEligible: true,
  },
  {
    domain: "pbkdfIterations",
    spec: {
      kind: "rfc",
      rfc: "RFC 7518",
      section: "4.8.1.2",
      url: "https://www.rfc-editor.org/rfc/rfc7518#section-4.8.1.2",
    },
    wire: {
      jose: wireName("p2c"),
      cose: wireAbsent(
        "PBES2 (RFC 7518 §4.8) is a JWE key-management algorithm; a COSE_Encrypt0 runs no recipient algorithm, so no password-derived key is produced.",
      ),
    },
    codec: { kind: "number" },
    cose: null,
    sensitivity: "public",
    sample: 310000,
    // PRUNE, and no empty value exists for it to act on: `isEmpty` is false for
    // every number and `isFinite` rejects every non-number (`token-header.ts`).
    // ⚠ `p2c: 0` is a VALUE, not an absence, and is never pruned — a zero iteration
    // count must fail where the derivation happens rather than vanish from the
    // header a recipient needs to reproduce it (RFC 7518 §4.8.1.2).
    whenEmpty: "prune",
    placement: "protected",
    critEligible: false,
  },
  {
    domain: "pbkdfSalt",
    spec: {
      kind: "rfc",
      rfc: "RFC 7518",
      section: "4.8.1.1",
      url: "https://www.rfc-editor.org/rfc/rfc7518#section-4.8.1.1",
    },
    wire: {
      jose: wireName("p2s"),
      cose: wireAbsent(
        "PBES2 (RFC 7518 §4.8) is a JWE key-management algorithm; a COSE_Encrypt0 runs no recipient algorithm, so no password-derived key is produced.",
      ),
    },
    codec: { kind: "buffer" },
    cose: null,
    sensitivity: "public",
    sample: Buffer.alloc(16),
    // PRUNE, on the `iv` argument: a zero-length Buffer is not empty and is not
    // governed here.
    whenEmpty: "prune",
    placement: "protected",
    critEligible: false,
  },
  {
    domain: "publicEncryptionTag",
    spec: {
      kind: "rfc",
      rfc: "RFC 7518",
      section: "4.7.1.2",
      url: "https://www.rfc-editor.org/rfc/rfc7518#section-4.7.1.2",
    },
    wire: {
      jose: wireName("tag"),
      cose: wireAbsent(
        "The key-wrap authentication tag is an AES-GCM-KW key-management output; a COSE_Encrypt0 wraps no key.",
      ),
    },
    codec: { kind: "buffer" },
    cose: null,
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
    spec: {
      kind: "rfc",
      rfc: "RFC 7515",
      section: "4.1.9",
      url: "https://www.rfc-editor.org/rfc/rfc7515#section-4.1.9",
    },
    wire: { jose: wireName("typ"), cose: wireLabel(16, "typ") }, // RFC 9596 §4.1
    codec: { kind: "string" },
    cose: { kind: "passthrough" },
    sensitivity: "public",
    // The FULL media type: aegis always writes and reports the complete form, so a
    // bare `"at+jwt"` here could not round-trip to itself (RFC 7515 §4.1.9).
    sample: "application/at+jwt",
    // PRUNE. ROUTING ON `typ` IS AEGIS POLICY, not a library requirement
    // (RFC 9596 §2): `assertWireTyp` gates every read on it, so `""` would leave the
    // token unroutable while looking declared. `buildMediaType` never returns `""`
    // and `encodeJoseHeader` refuses a falsy `typ`, so aegis's own write cannot
    // reach the cell.
    whenEmpty: "prune",
    placement: "protected",
    critEligible: false,
  },
  {
    domain: "certificateChain",
    spec: {
      kind: "rfc",
      rfc: "RFC 7515",
      section: "4.1.6",
      url: "https://www.rfc-editor.org/rfc/rfc7515#section-4.1.6",
    },
    wire: { jose: wireName("x5c"), cose: wireLabel(33, "x5c") }, // RFC 9360 x5chain
    codec: { kind: "array" },
    cose: { kind: "certChain" },
    sensitivity: "public",
    sample: ["MIIBsample"],
    // PRUNE. ⚠ NOT a restriction, and this is where it splits from `x5t#S256`
    // below: nothing reads `x5c` — the binding check consults a THUMBPRINT alone
    // (`verify-cert-binding.ts`) — so an empty chain restricts nothing.
    // `resolve-cert-binding.ts` already refuses to emit one.
    whenEmpty: "prune",
    placement: "protected",
    critEligible: false,
  },
  // RFC 7515 §4.1.7. Kit-derived from the signing/encrypting kryptos, auto-emitted
  // on JOSE whenever a cert is bound and the boolean resolves true.
  {
    domain: "certificateThumbprintSha1",
    spec: {
      kind: "rfc",
      rfc: "RFC 7515",
      section: "4.1.7",
      url: "https://www.rfc-editor.org/rfc/rfc7515#section-4.1.7",
    },
    wire: {
      jose: wireName("x5t"),
      cose: wireAbsent(
        "aegis keys a certificate thumbprint to one COSE parameter, x5t (label 34), whose COSE_CertHash value carries the digest algorithm as a member — so there is no second, SHA-1-named parameter to key. Unreachable on the WRITE side, where aegis emits SHA-256; on READ the SHA-1 digest still lands on this domain field, because label 34's `certHash` codec dispatches on hashAlg. RFC 9360 §2.",
      ),
    },
    codec: { kind: "string" },
    cose: null,
    sensitivity: "public",
    sample: "dGh1bWJwcmludC1zaGEx",
    // PRUNE: this digest is checked only where NO SHA-256 one arrived, and only in
    // lax mode (`verify-cert-binding.ts`), so its presence is never itself the
    // binding and an empty value binds nothing.
    whenEmpty: "prune",
    placement: "protected",
    critEligible: false,
  },
  {
    domain: "certificateThumbprint",
    spec: {
      kind: "rfc",
      rfc: "RFC 7515",
      section: "4.1.8",
      url: "https://www.rfc-editor.org/rfc/rfc7515#section-4.1.8",
    },
    wire: {
      jose: wireName("x5t#S256"),
      // RFC 9360 §2. It carries the `certHash` codec rather than a plain relabel
      // because the digest algorithm is a member of the VALUE — which is also why
      // ONE COSE label reaches TWO domain fields, and why the write emits SHA-256
      // and nothing else.
      cose: wireLabel(34, "x5t"),
    },
    codec: { kind: "string" },
    cose: { kind: "certHash" },
    sensitivity: "public",
    sample: "dGh1bWJwcmludC1zaGEyNTY",
    // REFUSE: `verify-cert-binding.ts` skips the check when this is absent and
    // refuses a mismatch when it is present, so PRESENCE IS THE BINDING. Pruning an
    // empty value would convert an unsatisfiable binding into NO binding; keeping it
    // would emit a token no certificate can satisfy. The write throws instead
    // (`refuse-empty-headers.ts`), where the producer still holds the value.
    //
    // ⚠ A BOUNDARY guard, not a repair of an aegis path: both caller-facing header
    // types Omit the field and `resolveCertBinding` reads a kryptos that answers
    // `null` or a real digest, so the one producer of `""` is a foreign `IKryptos`.
    //
    // ⚠ Do NOT generalise it to `x5c` or `x5t` — neither one's presence is a
    // binding.
    whenEmpty: "refuse",
    placement: "protected",
    critEligible: false,
  },
  // RFC 7515 §4.1.5; COSE label 35 (RFC 9360 §2).
  {
    domain: "certificateUrl",
    spec: {
      kind: "rfc",
      rfc: "RFC 7515",
      section: "4.1.5",
      url: "https://www.rfc-editor.org/rfc/rfc7515#section-4.1.5",
    },
    wire: { jose: wireName("x5u"), cose: wireLabel(35, "x5u") },
    codec: { kind: "string" },
    cose: { kind: "passthrough" },
    sensitivity: "public",
    sample: "https://issuer.lindorm.test/certs.pem",
    // PRUNE: `""` is not a URI (RFC 7515 §4.1.5). ⚠ This row carries the `string`
    // codec, not `url` like `jku`, so no guard drops an empty value earlier — this
    // cell is what stops it.
    whenEmpty: "prune",
    placement: "protected",
    critEligible: false,
  },
  // RFC 7516 §4.1.3 — compression algorithm.
  {
    domain: "zip",
    spec: {
      kind: "rfc",
      rfc: "RFC 7516",
      section: "4.1.3",
      url: "https://www.rfc-editor.org/rfc/rfc7516#section-4.1.3",
    },
    wire: {
      jose: wireName("zip"),
      cose: wireAbsent(
        "aegis compresses nothing on the COSE wire, so there is no compression algorithm to declare.",
      ),
    },
    codec: { kind: "string" },
    cose: null,
    sensitivity: "public",
    sample: "DEF",
    // PRUNE: `""` names no compression algorithm (RFC 7518 §7.3). aegis compresses
    // nothing on any write path, so an empty `zip` declares a transform that did not
    // happen — on a token `JweKit.decrypt` then refuses for merely CARRYING the
    // parameter. A FOREIGN token's `zip` is untouched: the read path is not
    // normalised.
    whenEmpty: "prune",
    placement: "protected",
    critEligible: false,
  },
];

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
// Integer COSE label -> spec. Only entries carrying a label are keyed.
const byCose = new Map<number, HeaderSpec>(
  HEADER_SPECS.flatMap((spec) => {
    const label = headerCoseLabel(spec);
    return label === undefined ? [] : [[label, spec] as const];
  }),
);
/**
 * COSE TEXT label -> spec, and NOT one entry per parameter: only the parameters
 * that can legitimately BE string-keyed on the COSE wire.
 *
 * ⚠ Gated on the same {@link isPrivateUseLabel} the write side uses, which keeps
 * the two spellings a single fact. A blanket "any label may also arrive as its
 * name" would let a foreign token deliver `typ` or `cty` under a text label aegis
 * never writes.
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
 * The JOSE wire name for a COSE label, or `undefined` if COSE carries no registered
 * parameter under it.
 *
 * ⚠ It takes a {@link CoseLabel}, not an integer (RFC 9052 §1.5), because the
 * interoperable default WRITES a text label for every private-use parameter. This
 * is the READ half of `coseWireKey`: an integer resolves through the label table, a
 * string through the text-label table, and neither answers for the other.
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
 * The COSE INTEGER header label for a JOSE wire parameter. THROWS if COSE does not
 * carry the parameter, reporting the registry's stated `reason`.
 *
 * ⚠ NOT the writer's resolver — that is {@link coseWireKey}. This answers the
 * narrower "which integer is this parameter registered at", which is what the READ
 * paths need to look a decoded label up. A writer reaching for it would put a
 * private-use integer on an interoperable wire.
 */
export const coseByJose = (jose: string): number => {
  const spec = byJose.get(jose);
  const label = spec ? headerCoseLabel(spec) : undefined;

  if (label === undefined) throw noCoseLabel(jose, spec);

  return label;
};

/**
 * THE WRITER'S RESOLVER: the COSE label a parameter is spelled by on the wire, in
 * the interop mode the caller asked for. Every COSE write path resolves through
 * this and nothing else, so a parameter, a `crit` member naming it and the
 * reserved-parameter guard all agree on one spelling. RFC 9052 §1.5.
 *
 *   - a REGISTERED integer label is written as the integer in both modes;
 *   - a PRIVATE-USE integer label ({@link isPrivateUseLabel}) means nothing to a
 *     foreign reader, so the default `proprietary: false` writes the parameter's
 *     string label instead — only the encoding of the key changes;
 *   - `proprietary: true` writes the compact private-use integer, which aegis
 *     reads either way.
 *
 * THROWS for a parameter COSE does not carry, as {@link coseByJose} does.
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
    // A parameter COSE keys by its NAME is already the string on every wire, so the
    // interop mode has nothing to choose. `WireKey` declares the case, so the
    // resolver answers it rather than casting it away.
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

/**
 * THE COSE VALUE CODEC for a JOSE wire parameter — the shape half of what
 * {@link coseWireKey} answers for the key half. Both COSE passes resolve through it
 * and switch over the result exhaustively.
 *
 * THROWS for a parameter COSE does not carry. Reaching that from the write pass
 * takes registry drift, which `header-registry.test.ts` binds the two cells
 * against.
 */
export const coseHeaderCodec = (jose: string): CoseHeaderCodec => {
  const spec = byJose.get(jose);
  const codec = spec?.cose;

  if (!codec) throw noCoseLabel(jose, spec);

  return codec;
};
