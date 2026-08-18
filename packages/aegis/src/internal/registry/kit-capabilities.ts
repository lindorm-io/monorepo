/**
 * The kit capability table — one row per {@link TokenFormatTag}, i.e. one row per
 * kit (`jwt` → JwtKit, `cwm` → CwmKit, …).
 *
 * It records what each kit CAN do, and each kit now READS its own row: the COSE
 * kits derive their reserved-parameter set from `reserved`, `CweKit` gates its
 * key management on `keyManagement` and its AEAD on `contentEncryption`, and the
 * JOSE header decoder allowlists `enc` against the `jwe` row. That is the point
 * of the table — before it, "a CWE is `dir`-only" was enforced nowhere, so a
 * non-`dir` key surfaced `@lindorm/aes`'s own "Content primitive requires a
 * direct key" from several layers down instead of an aegis refusal.
 */

import {
  KRYPTOS_ENC_ALGORITHMS,
  type KryptosAlgorithm,
  type KryptosEncryption,
} from "@lindorm/kryptos";
import { AES_ENCRYPTION_ALGORITHMS } from "@lindorm/types";
import type { TokenFormatTag } from "../../types/index.js";
import type { CnfMember, KitCapabilities } from "./capabilities.js";
import { CNF_JOSE_MEMBERS, COSE_CNF_MEMBERS } from "../claims/cnf-members.js";

const NONE_ALG: ReadonlySet<KryptosAlgorithm> = new Set();
const NONE_ENC: ReadonlySet<KryptosEncryption> = new Set();
const NO_CNF: ReadonlySet<CnfMember> = new Set();

/**
 * The confirmation members the JOSE `cnf` translator emits — DERIVED from the
 * member declaration the translator itself reads (`internal/claims/cnf-members.ts`).
 *
 * ⚠ IT WAS A HAND-WRITTEN LITERAL, and it was the FOURTH copy of the same five
 * names: the write table, the read table, the mint-side allow list and this row.
 * Nothing bound them to each other, so a member added to the translator and not
 * here would have been emitted on a wire the capability table said could not
 * carry it.
 */
const JOSE_CNF: ReadonlySet<CnfMember> = new Set(CNF_JOSE_MEMBERS);

/**
 * The confirmation members a COSE `cnf` map can carry — DERIVED from the same
 * declaration, through the `wire.cose` cells that carry an integer label. A
 * member is representable exactly when RFC 8747 gives it a label aegis writes,
 * and there is one place that says so, so this row cannot claim a member the
 * encoder would drop.
 */
const COSE_CNF: ReadonlySet<CnfMember> = new Set(COSE_CNF_MEMBERS);

/**
 * ⭐ THE RULE EVERY `reserved` ROW OBEYS, stated once:
 *
 *     reserved  =  KitOwnedHeaderParam  ∩  {what this wire can carry}
 *
 * `reserved` is the RUNTIME backstop for the type-level `KitOwnedHeaderParam`
 * Omit (`types/header/wire-envelope.ts`), and a backstop that lists FEWER
 * parameters than the type it backs up is not a backstop: the compiler stops a
 * typed caller, and an untyped one (`as never`, a JS consumer, a JSON body) walks
 * straight through the gap. Every row is therefore the WHOLE KitOwned set, less
 * only the parameters the row's wire has no spelling for.
 *
 * ⚠ The wire filter is MANDATORY, not cosmetic. `buildCoseHeaders` resolves every
 * reserved name through `coseWireKey`, which THROWS `header_no_cose_label` for a
 * parameter COSE does not carry — so listing `x5t` on a COSE row would fail every
 * mint that kit ever makes, not just a smuggling one.
 *
 * ⚠ `jku` is on NEITHER row, though it was on the JOSE one until the JOSE header
 * builder landed. It is a DEFAULT: the kit supplies the key's own `jwksUri` and
 * the caller may override it. Both type-level sets already said so — `jku` is
 * absent from `KitOwnedHeaderParam` and `jwksUri` from `KitOwnedDomainParam`, so
 * the parameter is offered on every public write surface — and listing it here
 * made the kits write the key's value LAST over the caller's, which discarded a
 * caller `jku` even when the key resolved none.
 */

/**
 * The JOSE rows: the whole `KitOwnedHeaderParam` set, because JOSE carries every
 * one of them (each has a `wire.jose` name in the header registry).
 *
 * ⚠ It is the SAME row on all three kits, including the eight key-management and
 * AEAD parameters only `JweKit` ever derives. A signing kit derives none of them,
 * which is exactly why it must refuse them: `aegis.jwt.sign(claims, { header: {
 * enc: "A256GCM", epk: {…} } as never })` used to emit a signed JWT advertising a
 * content encryption that never happened, because the params were absent from the
 * signing rows and so were merged straight onto the wire.
 */
const JOSE_RESERVED: ReadonlyArray<string> = [
  "alg",
  "apu",
  "apv",
  "enc",
  "epk",
  "iv",
  "kid",
  "p2c",
  "p2s",
  "tag",
  "typ",
  "x5c",
  "x5t",
  "x5t#S256",
];

/**
 * The COSE rows: the same `KitOwnedHeaderParam` set filtered to the five
 * parameters the COSE wire has a label for — `alg` (1), `iv` (5), `kid` (4),
 * `typ` (16, RFC 9596) and `x5c` (33, RFC 9360 x5chain). The other nine are
 * `wireAbsent` in the header registry, each with its stated reason: the ECDH-ES
 * and PBES2 outputs have no COSE_Encrypt0 counterpart, and COSE's `x5t` is a
 * `COSE_CertHash` structure rather than a relabelled JOSE thumbprint.
 *
 * ⚠ `x5c` and `iv` are the two that must not be dropped again:
 *
 * - `x5c` is derived from the signing key. No COSE kit derives one (`certificateBinding`
 *   is `false` on every row), so a caller value would be the ONLY certificate
 *   chain on the token — a forged chain the signing key never had, reported back
 *   as `verified.header.certificateChain`.
 * - `iv` is `placement: "either"` so `CweKit` can put it in the unprotected
 *   bucket, which means the placement rule cannot refuse it there. On the three
 *   SIGNED formats there is no IV at all, so a caller value would be a
 *   signature-uncovered `initialisationVector` on a token that verifies.
 */
const COSE_RESERVED: ReadonlyArray<string> = ["alg", "iv", "kid", "typ", "x5c"];

export const KIT_CAPABILITIES: Readonly<Record<TokenFormatTag, KitCapabilities>> = {
  jwt: {
    wire: "jose",
    keyManagement: NONE_ALG,
    contentEncryption: NONE_ENC,
    cnfMembers: JOSE_CNF,
    certificateBinding: true,
    unprotectedBucket: false,
    reserved: JOSE_RESERVED,
  },
  jws: {
    wire: "jose",
    keyManagement: NONE_ALG,
    contentEncryption: NONE_ENC,
    cnfMembers: NO_CNF,
    certificateBinding: true,
    unprotectedBucket: false,
    reserved: JOSE_RESERVED,
  },
  jwe: {
    wire: "jose",
    // JweKit delegates key management to `@lindorm/aes`, which covers the full
    // kryptos encryption-algorithm set; `decodeJoseHeader`'s allowlist
    // (`TOKEN_HEADER_ALGORITHMS`) is the union of the same per-key-type lists.
    keyManagement: new Set(KRYPTOS_ENC_ALGORITHMS),
    contentEncryption: new Set(AES_ENCRYPTION_ALGORITHMS),
    cnfMembers: JOSE_CNF,
    certificateBinding: true,
    unprotectedBucket: false,
    reserved: JOSE_RESERVED,
  },
  cwt: {
    wire: "cose",
    keyManagement: NONE_ALG,
    contentEncryption: NONE_ENC,
    cnfMembers: COSE_CNF,
    // `resolveCertBinding` has ZERO COSE callers — `bindCertificate` is accepted
    // and inert on every COSE path today. The capability is `false` because that
    // is what the kit can do; the ACCEPT-and-ignore is the defect above it.
    certificateBinding: false,
    unprotectedBucket: true,
    // `typ` is what routes a COSE token — `isCwt`/`isCws` and the profile floor
    // read it — so a caller value for it is refused, not merged. It used to be
    // absent from this list AND overridable: the kit spread `...options.header`
    // last over its own computed `typ`.
    reserved: COSE_RESERVED,
  },
  cwm: {
    wire: "cose",
    keyManagement: NONE_ALG,
    contentEncryption: NONE_ENC,
    cnfMembers: COSE_CNF,
    certificateBinding: false,
    unprotectedBucket: true,
    reserved: COSE_RESERVED,
  },
  cws: {
    wire: "cose",
    keyManagement: NONE_ALG,
    contentEncryption: NONE_ENC,
    cnfMembers: NO_CNF,
    certificateBinding: false,
    unprotectedBucket: true,
    reserved: COSE_RESERVED,
  },
  cwe: {
    wire: "cose",
    // COSE_Encrypt0 is DIRECT encryption: the recipient key IS the content
    // encryption key, so `alg` (label 1) carries the content encryption and no
    // key management happens at all. The nineteen other JWE key managements have
    // no COSE_Encrypt0 form.
    // `CweKit` refuses a non-`dir` key in its CONSTRUCTOR, off this set, before
    // any content reaches `@lindorm/aes`.
    keyManagement: new Set<KryptosAlgorithm>(["dir"]),
    // The official COSE labels (AES-GCM + the eight AES-CCM variants) plus the
    // private-use AES-CBC-HMAC labels, which together are the whole kryptos set;
    // the CBC-HMAC family requires `proprietary` mode (`enc-labels.ts`).
    contentEncryption: new Set(AES_ENCRYPTION_ALGORITHMS),
    cnfMembers: COSE_CNF,
    certificateBinding: false,
    unprotectedBucket: true,
    reserved: COSE_RESERVED,
  },
};
