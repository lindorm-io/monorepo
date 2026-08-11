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

const NONE_ALG: ReadonlySet<KryptosAlgorithm> = new Set();
const NONE_ENC: ReadonlySet<KryptosEncryption> = new Set();
const NO_CNF: ReadonlySet<CnfMember> = new Set();

/** The confirmation members the JOSE `cnf` translator emits (`translate.ts`). */
const JOSE_CNF: ReadonlySet<CnfMember> = new Set([
  "jkt",
  "x5t#S256",
  "jwk",
  "kid",
  "jku",
]);

/**
 * The confirmation members a COSE `cnf` map can carry (`cose/cose-key.ts`
 * `encodeCnf`): an embedded key (member 1) and a key id (member 3). The
 * thumbprint forms have NO COSE representation.
 */
const COSE_CNF: ReadonlySet<CnfMember> = new Set(["jwk", "kid"]);

/** The header parameters every JOSE kit stamps itself (kit value spread LAST). */
const JOSE_RESERVED: ReadonlyArray<string> = [
  "alg",
  "typ",
  "jku",
  "kid",
  "x5c",
  "x5t",
  "x5t#S256",
];

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
    reserved: [...JOSE_RESERVED, "enc", "iv", "apu", "apv", "epk", "p2c", "p2s", "tag"],
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
    reserved: ["alg", "kid", "typ"],
  },
  cwm: {
    wire: "cose",
    keyManagement: NONE_ALG,
    contentEncryption: NONE_ENC,
    cnfMembers: COSE_CNF,
    certificateBinding: false,
    unprotectedBucket: true,
    reserved: ["alg", "kid", "typ"],
  },
  cws: {
    wire: "cose",
    keyManagement: NONE_ALG,
    contentEncryption: NONE_ENC,
    cnfMembers: NO_CNF,
    certificateBinding: false,
    unprotectedBucket: true,
    reserved: ["alg", "kid", "typ"],
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
    reserved: ["alg", "kid", "iv", "typ"],
  },
};
