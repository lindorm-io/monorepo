/**
 * The kit capability table — one row per {@link TokenFormatTag}, i.e. one row per
 * kit (`jwt` → JwtKit, `cwm` → CwmKit, …).
 *
 * ⚠ It records what each kit CAN do, read off the kits at this commit. Where a
 * kit does not yet ENFORCE its own row, that is called out inline rather than
 * silently corrected here — a capability table that quietly disagreed with the
 * code would be the same defect it exists to close.
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
    // ⚠ `typ` is NOT in the reserved set the kit passes to `buildCoseHeaders`
    // (`CwsKit.ts:366`), even though the kit computes it — `...options.header`
    // spreads last, so a caller `typ` wins. Recorded as-is.
    reserved: ["alg", "kid"],
  },
  cwm: {
    wire: "cose",
    keyManagement: NONE_ALG,
    contentEncryption: NONE_ENC,
    cnfMembers: COSE_CNF,
    certificateBinding: false,
    unprotectedBucket: true,
    reserved: ["alg", "kid"],
  },
  cws: {
    wire: "cose",
    keyManagement: NONE_ALG,
    contentEncryption: NONE_ENC,
    cnfMembers: NO_CNF,
    certificateBinding: false,
    unprotectedBucket: true,
    reserved: ["alg", "kid"],
  },
  cwe: {
    wire: "cose",
    // COSE_Encrypt0 is DIRECT encryption: the recipient key IS the content
    // encryption key, so `alg` (label 1) carries the content encryption and no
    // key management happens at all. The nineteen other JWE key managements have
    // no COSE_Encrypt0 form.
    // ⚠ CweKit does not yet REFUSE a non-`dir` key ITSELF. The mint still fails,
    // but only once the key reaches `@lindorm/aes`, which throws its own
    // "Content primitive requires a direct key" several layers down — a FOREIGN
    // error, which is precisely what this row exists to replace with an aegis
    // refusal raised before key resolution.
    keyManagement: new Set<KryptosAlgorithm>(["dir"]),
    // The official COSE labels (AES-GCM + the eight AES-CCM variants) plus the
    // private-use AES-CBC-HMAC labels, which together are the whole kryptos set;
    // the CBC-HMAC family requires `proprietary` mode (`enc-labels.ts`).
    contentEncryption: new Set(AES_ENCRYPTION_ALGORITHMS),
    cnfMembers: COSE_CNF,
    certificateBinding: false,
    unprotectedBucket: true,
    // ⚠ Same `typ` gap as the signing kits (`CweKit.ts:120`).
    reserved: ["alg", "kid", "iv"],
  },
};
