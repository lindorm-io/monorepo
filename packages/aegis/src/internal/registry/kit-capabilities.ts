/**
 * The kit capability table — one row per {@link TokenFormatTag}, i.e. one row per
 * kit (`jwt` → JwtKit, `cwm` → CwmKit, …).
 *
 * It records what each kit CAN do, and each kit READS its own row: the COSE kits
 * derive their reserved-parameter set from `reserved`, `CweKit` gates its key
 * management on `keyManagement`, and the JOSE header decoder allowlists `enc`
 * against the `jwe` row. Without it an unsupported
 * request surfaces `@lindorm/aes`'s own error from several layers down instead of
 * an aegis refusal.
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
 * The confirmation members the JOSE `cnf` translator emits — DERIVED from the member
 * declaration the translator itself reads (`internal/claims/cnf-members.ts`), so a
 * member added there cannot be emitted on a wire this table says cannot carry it.
 */
const JOSE_CNF: ReadonlySet<CnfMember> = new Set(CNF_JOSE_MEMBERS);

/**
 * The confirmation members a COSE `cnf` map can carry — DERIVED from the same
 * declaration, through the `wire.cose` cells that carry an integer label
 * (RFC 8747 §3.1), so this row cannot claim a member the encoder would drop.
 */
const COSE_CNF: ReadonlySet<CnfMember> = new Set(COSE_CNF_MEMBERS);

/**
 * ⭐ THE RULE EVERY `reserved` ROW OBEYS, stated once:
 *
 *     reserved  =  KitOwnedHeaderParam  ∩  {what this wire can carry}
 *
 * `reserved` is the RUNTIME backstop for the type-level `KitOwnedHeaderParam` Omit
 * (`types/header/wire-envelope.ts`), and a backstop listing FEWER parameters than
 * the type it backs up is not a backstop: the compiler stops a typed caller, and an
 * untyped one (`as never`, a JS consumer, a JSON body) walks through the gap.
 *
 * ⚠ The wire filter is MANDATORY, not cosmetic. `buildCoseHeaders` resolves every
 * reserved name through `coseWireKey`, which THROWS `header_no_cose_label` for a
 * parameter COSE does not carry — so listing `x5t` on a COSE row would fail every
 * mint that kit makes, not just a smuggling one.
 *
 * ⛔ `jku` IS ON NEITHER ROW. It is a DEFAULT: the kit supplies the key's own
 * `jwksUri` and the caller may override it — `jku` is absent from
 * `KitOwnedHeaderParam` and `jwksUri` from `KitOwnedDomainParam`, so the parameter
 * is offered on every public write surface. Listing it here would make a caller's
 * `jku` THROW `jose_reserved_header` in `buildJoseHeader` rather than override the
 * key's — the kit writes the key's value at the `defaults` tier either way. Pinned
 * by `kit-capabilities.test.ts`'s "reserved (JOSE): jku is NOT on it" row.
 */

/**
 * The JOSE rows: the whole `KitOwnedHeaderParam` set, because JOSE carries every one
 * of them (each has a `wire.jose` name in the header registry).
 *
 * ⚠ THE SAME ROW ON ALL THREE KITS, including the key-management and AEAD
 * parameters only `JweKit` derives. A signing kit derives none of them, which is
 * exactly why it must refuse them — otherwise
 * `aegis.jwt.sign(claims, { header: { enc: "A256GCM" } as never })` emits a signed
 * JWT advertising a content encryption that never happened.
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
 * The COSE rows: the same `KitOwnedHeaderParam` set filtered to the parameters the
 * COSE wire has a label for. The rest are `wireAbsent` in the header registry, each
 * with its stated reason.
 *
 * ⚠ `x5c`, `x5t#S256` and `iv` are the three that must not be dropped:
 *
 * - `x5c` and `x5t#S256` are derived from the signing key, so a caller value would
 *   be the ONLY certificate statement on the token — a forged chain or digest,
 *   reported back as `verified.header.certificateChain` / `.certificateThumbprint`.
 * - `iv` is `placement: "either"` so `CweKit` can put it in the unprotected bucket,
 *   which means the placement rule cannot refuse it there. The SIGNED COSE formats
 *   have no IV at all, so a caller value would be a signature-uncovered
 *   `initialisationVector` on a token that verifies.
 */
const COSE_RESERVED: ReadonlyArray<string> = [
  "alg",
  "iv",
  "kid",
  "typ",
  "x5c",
  "x5t#S256",
];

export const KIT_CAPABILITIES: Readonly<Record<TokenFormatTag, KitCapabilities>> = {
  jwt: {
    wire: "jose",
    keyManagement: NONE_ALG,
    contentEncryption: NONE_ENC,
    cnfMembers: JOSE_CNF,
    reserved: JOSE_RESERVED,
  },
  jws: {
    wire: "jose",
    keyManagement: NONE_ALG,
    contentEncryption: NONE_ENC,
    cnfMembers: NO_CNF,
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
    reserved: JOSE_RESERVED,
  },
  cwt: {
    wire: "cose",
    keyManagement: NONE_ALG,
    contentEncryption: NONE_ENC,
    cnfMembers: COSE_CNF,
    // `typ` is what routes a COSE token — `isCwt`/`isCws` and the profile floor read
    // it — so a caller value for it is refused, not merged.
    reserved: COSE_RESERVED,
  },
  cwm: {
    wire: "cose",
    keyManagement: NONE_ALG,
    contentEncryption: NONE_ENC,
    cnfMembers: COSE_CNF,
    reserved: COSE_RESERVED,
  },
  cws: {
    wire: "cose",
    keyManagement: NONE_ALG,
    contentEncryption: NONE_ENC,
    cnfMembers: NO_CNF,
    reserved: COSE_RESERVED,
  },
  cwe: {
    wire: "cose",
    // A COSE_Encrypt0 carries no recipients array and runs no recipient algorithm,
    // so `alg` (label 1) carries the CONTENT encryption and the recipient key IS the
    // content-encryption key (RFC 9052 §5.2). `CweKit` refuses a non-`dir` key in
    // its CONSTRUCTOR, off this set, before any content reaches `@lindorm/aes`.
    keyManagement: new Set<KryptosAlgorithm>(["dir"]),
    // The registered COSE labels plus the private-use AES-CBC-HMAC ones, which
    // together are the whole kryptos set; the CBC-HMAC family requires `proprietary`
    // mode (`enc-labels.ts`).
    contentEncryption: new Set(AES_ENCRYPTION_ALGORITHMS),
    cnfMembers: COSE_CNF,
    reserved: COSE_RESERVED,
  },
};
