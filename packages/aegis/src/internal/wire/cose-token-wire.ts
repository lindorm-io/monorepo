import { isBuffer, isString } from "@lindorm/is";
import type { KryptosAlgorithm } from "@lindorm/kryptos";
import { CwmKit } from "../../classes/CwmKit.js";
import { CwtKit } from "../../classes/CwtKit.js";
import type { TokenContent, TokenFormatTag, TokenProfileTyp } from "../../types/index.js";
import { coseName } from "../claims/claims-registry.js";
import { domainToWire } from "../claims/translate.js";
import { Tag } from "../cose/cbor.js";
import { selectCoseClaimsKit } from "../cose/cose-claims-kit.js";
import { coseEncryptDomainHeader } from "./cose-encrypt-domain-header.js";
import {
  decodeEncryptedCoseKid,
  decryptCose,
  encryptCose,
} from "../cose/cose-encryption.js";
import { coseTyp } from "../cose/cose-typ.js";
import { COSE_TAG } from "../cose/structures.js";
import { decodeCwt } from "../cose/decode-cwt.js";
import { decodeCwtWire } from "../cose/decode-cwt-wire.js";
import { ERROR_BY_FORMAT } from "../cose/error-by-format.js";
import { assertWireTyp } from "../utils/assert-wire-typ.js";
import { validateCrit } from "../utils/validate-crit.js";
import { rawSignCose } from "../utils/raw-sign-cose.js";
import { rawVerifyCws } from "../utils/raw-verify-cws.js";
import { buildSignedToken } from "../utils/build-signed-token.js";
import { computeTypHeader, extractTypPrefix } from "../utils/compute-typ-header.js";
import type { TokenWire, WireInputDispositions } from "./token-wire.js";

/** The two COSE claims formats one structure tag decides between. */
type ClaimsCoseFormat = Extract<TokenFormatTag, "cwt" | "cwm">;

/**
 * The COSE structure tag decides `cwt` vs `cwm` on READ: a COSE_Sign1 (tag 18,
 * asymmetric) is a `cwt`, a COSE_Mac0 (tag 17, symmetric) a `cwm`. The inner tag,
 * with the outer CWT tag 61 already stripped by the decoder.
 */
const coseFormatOf = (cose: unknown): ClaimsCoseFormat =>
  cose instanceof Tag && cose.tag === COSE_TAG.mac0 ? "cwm" : "cwt";

/**
 * RFC 7518 §4.6 scopes `apu`/`apv` to JOSE key-agreement algorithms, and aegis's
 * COSE outer is a COSE_Encrypt0 — RFC 9052 §5.2 defines that as single-recipient
 * DIRECT encryption. There is no key agreement for PartyUInfo/PartyVInfo to feed
 * and no COSE header parameter registered to carry either.
 */
const NO_COSE_KEY_AGREEMENT =
  "A COSE_Encrypt0 performs no key agreement. RFC 9052 §5.2 defines it as single-recipient direct encryption, and RFC 7518 §4.6 scopes the ECDH-ES party info to JOSE key-agreement algorithms, so there is nothing for the value to derive and no COSE header parameter to carry it.";

/** What the COSE wire does with each kit option it is handed. */
const COSE_DISPOSITIONS: WireInputDispositions = {
  signClaims: {
    header: { use: "forwarded" },
    unprotected: { use: "forwarded" },
    tokenType: { use: "forwarded" },
    bindCertificate: { use: "forwarded" },
    proprietary: { use: "forwarded" },
  },

  signOpaque: {
    header: { use: "forwarded" },
    unprotected: { use: "forwarded" },
    tokenType: { use: "forwarded" },
    bindCertificate: { use: "forwarded" },
    proprietary: { use: "forwarded" },
  },

  encryptContent: {
    header: { use: "forwarded" },
    unprotected: { use: "forwarded" },
    tokenType: { use: "forwarded" },
    bindCertificate: { use: "forwarded" },
    proprietary: { use: "forwarded" },
    partyProducer: { use: "unsupported", reason: NO_COSE_KEY_AGREEMENT },
    partyRecipient: { use: "unsupported", reason: NO_COSE_KEY_AGREEMENT },
  },

  decrypt: {},
};

/** The COSE wire: RFC 9052 structures, a protected and an unprotected bucket. */
export const COSE_TOKEN_WIRE: TokenWire = {
  dispositions: COSE_DISPOSITIONS,

  nameOf: coseName,

  // RFC 9596 leaves the COSE `typ` (label 16) optional, so a conformant foreign
  // CWT may carry none and a presence default of "required" would refuse it.
  defaultTypPresence: "optional",

  // The COSE claims read has never required an `iss`, and nothing yet says it
  // should — see the note on `TokenWire.issuerPresence`.
  issuerPresence: "optional",

  encryptedFormat: "cwe",

  // A COSE_Encrypt0 over an opaque CWS has never been readable here (the claims
  // decoder refuses the `+cws` media type), so admitting one would be a new
  // capability rather than a repair.
  encryptedInner: ["cwt", "cwm"],

  // What a COSE_Encrypt0 declares over each nested token it can seal, so the read
  // side reconstructs the plaintext to the inner BYTES rather than to the
  // inferred octet blob.
  //
  // ⚠ BOTH claims structures answer `application/cwt` (RFC 8392 §9.2), and that
  // is not a shortcut: RFC 8392 §7.1 step 4 defines a CWT as the Message secured
  // by a COSE_Sign1 *or* a COSE_Mac0 ("Else, if the CWT is MACed, create a
  // COSE_Mac/COSE_Mac0 object using the Message as the … Payload"), and
  // Appendix A.4 is titled "Example MACed CWT". A COSE_Mac0 CWT IS a CWT, so the
  // registered CWT media type describes it exactly.
  //
  // There is deliberately NO `cws` entry, and for two reasons that hold on their
  // own:
  //
  //  1. `encryptedInner` above admits only `cwt` and `cwm`, so a COSE_Encrypt0
  //     from this wire can never seal a CWS. An entry here would declare a cty
  //     for a nesting that cannot be built.
  //  2. RFC 9052 §11.3.1 registers `application/cose` PLAIN, with `cose-type` an
  //     OPTIONAL parameter — the qualified `application/cose;
  //     cose-type="cose-sign1"` spelling belongs to Table 2, the CoAP
  //     Content-Formats registry, which is a different registry. And §2 makes the
  //     parameter's absence meaningful rather than free: "The parameter is
  //     OPTIONAL if the tagged version of the structure is used. The parameter is
  //     REQUIRED if the untagged version is used." So a bare `application/cose`
  //     leaves the structure ambiguous unless the tag carries it.
  //
  // A gap is honest where an invented media type is not.
  nestedTokenCty: {
    cwt: "application/cwt",
    cwm: "application/cwt",
  },

  // The outer COSE_Encrypt0's typ is cosmetic — the read path decrypts, then
  // verifies the inner token — so it carries the same profile prefix the inner
  // does. ⚠ The JOSE outer carries none; see `TokenWire.nestedTokenTyp`.
  nestedTokenTyp: "inner",

  profileTyp: (typ: TokenProfileTyp) => coseTyp(typ),

  // ⚠ The profile, and only the profile. A caller's explicit `typ` and the
  // content's own `tokenType` have never reached the COSE mint; that gap is
  // recorded, not closed here.
  mintTypPrefix: ({ profile, format }) => extractTypPrefix(coseTyp(profile.typ), format),

  assertedTyp: (tokenType) =>
    coseTyp({ presence: "required", value: computeTypHeader(tokenType, "jwt") }),

  decodeClaims: (token) => {
    const bytes = Buffer.from(token, "base64url");
    const decoded = decodeCwt(bytes);
    const { payload, protectedHeader, unprotectedHeader } = decodeCwtWire(bytes);
    const format = coseFormatOf(decoded.cose);

    // The structural invariants a CWT must satisfy to be READ as one — the twin
    // of the JOSE keyless read's pair, and here for the same reason: a keyless
    // parse checks no signature, but it still has to refuse a token whose own
    // envelope is malformed, because everything downstream reads it as a CWT.
    // Same shape as `verifyCwt`'s gate, one word apart — that path is about to
    // check a signature and says "verified", this one says "parsed".
    assertWireTyp({
      typ: decoded.typ,
      accept: ["application/cwt"],
      suffix: "+cwt",
      presence: "optional",
      error: ERROR_BY_FORMAT[format],
      code: `${format}_invalid_typ`,
      // Derived alongside the code, so a COSE_Mac0 reads as a CWM here too —
      // `coseFormatOf` above resolves `cwm` on this very path.
      title: `${format.toUpperCase()} Invalid Typ`,
      details:
        "Header typ is present but is not CWT or a <type>+cwt media type, so the token cannot be parsed as a CWT.",
    });

    // `crit` off the PROTECTED bucket alone — the only one a signature covers and
    // the only one RFC 9052 §3.1 permits it in.
    const critError = validateCrit(protectedHeader);
    if (critError) {
      throw new ERROR_BY_FORMAT[format](`Invalid crit header: ${critError}`, {
        code: `${format}_invalid_crit`,
        data: { crit: protectedHeader.crit },
        title: `${format.toUpperCase()} Invalid Crit`,
        details:
          "The crit header is malformed; it must be a non-empty array of strings naming extension parameters present in the header.",
      });
    }

    return {
      format,
      // The COSE claim codec decodes temporal claims to `Date`s inside the kit,
      // so the wire payload and the matcher payload are the same object here.
      wire: payload,
      matcher: payload,
      protectedHeader,
      unprotectedHeader,
    };
  },

  verifyClaims: async ({ token, deps, options, issuer }) => {
    const bytes = Buffer.from(token, "base64url");
    const decoded = decodeCwt(bytes);

    // Verifier-declared issuer wins; else the CWT's own UNVERIFIED `iss` (a
    // COSE_Sign1/Mac0 payload is cleartext CBOR); else unscoped. Narrowing only —
    // the same contract the JOSE path uses.
    const kryptos = await deps.resolveVerifyKey({
      id: decoded.kid,
      algorithm: undefined,
      issuer:
        issuer ?? (isString(decoded.payload?.iss) ? decoded.payload.iss : undefined),
      verify: options.key,
    });

    const clockTolerance = options.clockTolerance ?? deps.clockTolerance;

    const { payload, protectedHeader, unprotectedHeader } = selectCoseClaimsKit({
      certBindingMode: deps.certBindingMode,
      kryptos,
      logger: deps.logger,
      clockTolerance,
    }).verify(bytes, undefined, {
      clockTolerance,
      currentDate: options.currentDate,
      maxTokenAge: options.maxTokenAge,
      verifyExpiration: options.verifyExpiration,
      verifyNotBefore: options.verifyNotBefore,
      verifyIssuedAt: options.verifyIssuedAt,
      verifyAuthTime: options.verifyAuthTime,
    });

    return {
      format: coseFormatOf(decoded.cose),
      wire: payload,
      matcher: payload,
      protectedHeader,
      unprotectedHeader,
      // The protected-header alg the kit has already refused to accept unless it
      // equals the resolved key's own (`cwt_algorithm_mismatch` /
      // `cwm_algorithm_mismatch`) — the COSE twin of the JOSE cross-check.
      algorithm: decoded.algorithm as KryptosAlgorithm,
    };
  },

  verifyOpaque: async ({ token, deps, options }) => {
    const verified = await rawVerifyCws({ token, options: { key: options.key }, deps });

    return {
      format: "cws",
      payload: verified.payload,
      protectedHeader: verified.protectedHeader,
      unprotectedHeader: verified.unprotectedHeader,
    };
  },

  // The WRITE side selects the kit by the explicit FORMAT, not by the resolved
  // key's class: the kit's own class gate is then the backstop, so `format: "cwt"`
  // with a symmetric key throws instead of silently MAC-ing.
  signClaims: ({ kryptos, deps, common, format, ...options }) => {
    const wireClaims = domainToWire(common, coseName);

    const kit =
      format === "cwm"
        ? new CwmKit({
            certBindingMode: deps.certBindingMode,
            kryptos,
            logger: deps.logger,
          })
        : new CwtKit({
            certBindingMode: deps.certBindingMode,
            kryptos,
            logger: deps.logger,
          });

    const token = kit.sign(wireClaims, options);

    return buildSignedToken(
      token.toString("base64url"),
      wireClaims,
      options.header?.oid,
      format === "cwm" ? "cwm" : "cwt",
      coseName,
    );
  },

  // `bindCertificate` is forwarded and acted on — `CwsKit.sign` resolves it
  // against the signing key.
  signOpaque: ({ deps, payload, key, ...options }) =>
    rawSignCose({ input: { payload, key, ...options }, deps }),

  // ONE door. The content reaches the kit AS THE TYPE THE CALLER PASSED — a
  // string stays a string, so the kit's codec answers `text/plain` and `decrypt`
  // reconstructs the string; a Dict is serialised under its own literal keys.
  // There is no second claims door to select between: an encrypt seals the value
  // it was given, and a `{ iss: "x" }` that was never declared a claims set must
  // not have its keys promoted to RFC 8392 integer labels a foreign reader trusts.
  //
  // ⚠ A NESTED token's cty rides `options.header.cty`, resolved from
  // `nestedTokenCty` above the seam by whichever entry point sealed the token.
  encryptContent: ({ kryptos, deps, content, ...options }) =>
    encryptCose({
      certBindingMode: deps.certBindingMode,
      kryptos,
      logger: deps.logger,
      defaultEncryption: deps.defaultEncryption,
      options,
      content,
    }).toString("base64url"),

  decrypt: async ({ token, deps, key }) => {
    const bytes = Buffer.from(token, "base64url");

    // The SHARED wire→domain translation, the same one the verify and parse
    // paths run: both buckets in, one canonically merged domain header out.
    const header = coseEncryptDomainHeader(bytes);

    // The CWE (COSE_Encrypt0) outer resolves UNSCOPED — its claims sit behind the
    // very key being resolved, exactly as for the outer JWE. The signed inner
    // CWT/CWM below IS scoped.
    const kryptos = await deps.resolveDecryptKey(
      decodeEncryptedCoseKid(bytes),
      undefined,
      key,
    );

    // The plaintext, reconstructed by the cty on the PROTECTED bucket — which is
    // the COSE_Encrypt0's AAD, so a tampered declaration fails the AEAD rather
    // than steering the read. Reported verbatim: there is no second door to route
    // to and nothing about the value is re-interpreted here.
    return {
      header,
      payload: decryptCose<TokenContent>({
        certBindingMode: deps.certBindingMode,
        kryptos,
        logger: deps.logger,
        token: bytes,
      }),
      token,
    };
  },

  decodeToken: (token) => Buffer.from(token, "base64url"),

  // A COSE token's native form is its BYTES, so a Buffer plaintext re-serialises
  // to the base64url string every aegis COSE surface speaks. A reconstructed
  // object is not a token and yields nothing.
  encodeToken: (content) =>
    isBuffer(content)
      ? content.toString("base64url")
      : isString(content)
        ? content
        : undefined,
};
