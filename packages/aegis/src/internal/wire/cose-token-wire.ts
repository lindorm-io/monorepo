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
import { writtenHeader } from "../header/written-header.js";
import { rawSignCose } from "../utils/raw-sign-cose.js";
import { rawVerifyCws } from "../utils/raw-verify-cws.js";
import { buildSignedToken } from "../utils/build-signed-token.js";
import { computeTypHeader } from "../utils/compute-typ-header.js";
import type { TokenWire, WireInputDispositions } from "./token-wire.js";

type ClaimsCoseFormat = Extract<TokenFormatTag, "cwt" | "cwm">;

/** The INNER structure tag — `decodeCwt` has already stripped the outer CWT tag 61. */
const coseFormatOf = (cose: unknown): ClaimsCoseFormat =>
  cose instanceof Tag && cose.tag === COSE_TAG.mac0 ? "cwm" : "cwt";

const NO_COSE_KEY_AGREEMENT =
  "A COSE_Encrypt0 carries no recipients array and runs no recipient algorithm, so there is no key-agreement step for the ECDH-ES party info to describe. See RFC 9052 §5.2 and RFC 7518 §4.6.";

/**
 * What the COSE wire does with each kit option it is handed.
 *
 * ⚠ A ROW SPEAKS FOR A TOP-LEVEL KEY AND NOTHING BELOW IT: `buildCoseHeaders` reads
 * `custom.protected`/`custom.unprotected` alone, and the JOSE-spelled
 * `custom.header` is a COMPILE error on the public COSE doors (pinned in
 * `types/header/wire-envelope.test.ts`); it arrives only through the untyped seam.
 */
const COSE_DISPOSITIONS: WireInputDispositions = {
  signClaims: {
    header: { use: "forwarded" },
    custom: { use: "forwarded" },
    tokenType: { use: "forwarded" },
    bindCertificate: { use: "forwarded" },
    proprietary: { use: "forwarded" },
  },

  signOpaque: {
    header: { use: "forwarded" },
    custom: { use: "forwarded" },
    tokenType: { use: "forwarded" },
    bindCertificate: { use: "forwarded" },
    proprietary: { use: "forwarded" },
  },

  encryptContent: {
    header: { use: "forwarded" },
    custom: { use: "forwarded" },
    tokenType: { use: "forwarded" },
    bindCertificate: { use: "forwarded" },
    proprietary: { use: "forwarded" },
    partyProducer: { use: "unsupported", reason: NO_COSE_KEY_AGREEMENT },
    partyRecipient: { use: "unsupported", reason: NO_COSE_KEY_AGREEMENT },
  },

  decrypt: {
    // The read-side `crit` declaration reaches the kit's own decrypt door, which
    // is where the crit gate runs — `JweKit.decrypt` through
    // `assert-protected-header-gates.ts`, `CweKit.decrypt` directly.
    crit: { use: "forwarded" },
  },
};

/** The COSE wire — RFC 9052 structures, a protected and an unprotected bucket. */
export const COSE_TOKEN_WIRE: TokenWire = {
  dispositions: COSE_DISPOSITIONS,

  nameOf: coseName,

  // RFC 9596 §2.
  defaultTypPresence: "optional",

  // See the note on `TokenWire.issuerPresence`.
  issuerPresence: "optional",

  encryptedFormat: "cwe",

  // No `cws`: the claims decoder refuses the `+cws` media type.
  encryptedInner: ["cwt", "cwm"],

  // What a COSE_Encrypt0 declares over each nested token it can seal, so the read
  // side reconstructs the plaintext to the inner BYTES rather than an octet blob.
  // BOTH claims structures answer `application/cwt` — a COSE_Mac0 CWT is a CWT
  // (RFC 8392 §7.1, RFC 8392 §9.2).
  //
  // ⚠ No `cws` entry: `encryptedInner` above admits only `cwt`/`cwm`, so this wire
  // can never seal a CWS — and no unambiguous media type exists to declare for one
  // (RFC 9052 §11.3.1). A gap is honest where an invented media type is not.
  nestedTokenCty: {
    cwt: "application/cwt",
    cwm: "application/cwt",
  },

  // The outer COSE_Encrypt0's typ is cosmetic — the read path decrypts, then
  // verifies the inner token — so it carries the same profile prefix the inner
  // does. ⚠ The JOSE outer carries none; see `TokenWire.nestedTokenTyp`.
  nestedTokenTyp: "inner",

  profileTyp: (typ: TokenProfileTyp) => coseTyp(typ),

  assertedTyp: (tokenType) =>
    coseTyp({ presence: "required", value: computeTypHeader(tokenType, "jwt") }),

  decodeClaims: (token) => {
    const bytes = Buffer.from(token, "base64url");
    const decoded = decodeCwt(bytes);
    const { payload, protectedHeader, unprotectedHeader, custom } = decodeCwtWire(bytes);
    const format = coseFormatOf(decoded.cose);

    // A keyless parse checks no signature but still refuses a malformed envelope —
    // the same gate `verifyCwt` runs, worded "parsed" rather than "verified".
    assertWireTyp({
      typ: decoded.typ,
      accept: ["application/cwt"],
      suffix: "+cwt",
      presence: "optional",
      error: ERROR_BY_FORMAT[format],
      code: `${format}_invalid_typ`,
      // Derived alongside the code, so a COSE_Mac0 reads as a CWM here too
      // (`coseFormatOf` above).
      title: `${format.toUpperCase()} Invalid Typ`,
      details:
        "Header typ is present but is not CWT or a <type>+cwt media type, so the token cannot be parsed as a CWT.",
    });

    // `crit` off the PROTECTED bucket alone — the only one a signature covers
    // (RFC 9052 §3.1) — and the header AS WRITTEN (`written-header.ts`).
    const written = writtenHeader(protectedHeader, custom.protected);

    const critError = validateCrit(written);
    if (critError) {
      throw new ERROR_BY_FORMAT[format](`Invalid crit header: ${critError}`, {
        code: `${format}_invalid_crit`,
        // ⚠ `written`, not the typed bag — a foreign CWT carrying a tstr `"crit"`
        // and no integer label 2 reaches exactly the `{ crit: undefined }` this
        // avoids. Same value the JOSE twin reports.
        data: { crit: written.crit },
        title: `${format.toUpperCase()} Invalid Crit`,
        details:
          "The crit header is malformed; it must be a non-empty array of strings naming extension parameters present in the header.",
      });
    }

    return {
      format,
      // The COSE claim codec decodes temporal claims to `Date`s inside the kit, so
      // the wire payload and the matcher payload are the same object here.
      wire: payload,
      matcher: payload,
      protectedHeader,
      unprotectedHeader,
    };
  },

  verifyClaims: async ({ token, deps, options, crit, issuer }) => {
    const bytes = Buffer.from(token, "base64url");
    const decoded = decodeCwt(bytes);

    // Verifier-declared issuer wins; else the CWT's own UNVERIFIED `iss` (a
    // COSE_Sign1/Mac0 payload is cleartext CBOR); else unscoped. Narrowing only.
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
      crit,
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
      // The protected-header alg the kit already refuses unless it equals the
      // resolved key's own (`cwt_algorithm_mismatch` / `cwm_algorithm_mismatch`).
      algorithm: decoded.algorithm as KryptosAlgorithm,
    };
  },

  verifyOpaque: async ({ token, deps, options, crit }) => {
    const verified = await rawVerifyCws({
      token,
      options: { key: options.key, crit },
      deps,
    });

    return {
      format: "cws",
      payload: verified.payload,
      protectedHeader: verified.protectedHeader,
      unprotectedHeader: verified.unprotectedHeader,
    };
  },

  // The WRITE side selects the kit by the explicit FORMAT, not by the resolved key's
  // class — the kit's own class gate is the backstop, so `format: "cwt"` with a
  // symmetric key throws instead of silently MAC-ing.
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

  // ONE door. The content reaches the kit AS THE TYPE THE CALLER PASSED, so a
  // `{ iss: "x" }` that was never declared a claims set does not have its keys
  // promoted to RFC 8392 integer labels a foreign reader trusts.
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

  decrypt: async ({ token, deps, key, crit }) => {
    const bytes = Buffer.from(token, "base64url");

    const header = coseEncryptDomainHeader(bytes);

    // The CWE (COSE_Encrypt0) outer resolves UNSCOPED — its claims sit behind the
    // very key being resolved, exactly as for the outer JWE. The signed inner
    // CWT/CWM below IS scoped.
    const kryptos = await deps.resolveDecryptKey(
      decodeEncryptedCoseKid(bytes),
      undefined,
      key,
    );

    // The plaintext, reconstructed by the cty on the PROTECTED bucket — the AEAD's
    // AAD (RFC 9052 §5.3), so a tampered declaration fails the AEAD rather than
    // steering the read. Reported verbatim.
    return {
      header,
      payload: decryptCose<TokenContent>({
        certBindingMode: deps.certBindingMode,
        crit,
        defaultEncryption: deps.defaultEncryption,
        kryptos,
        logger: deps.logger,
        token: bytes,
      }),
      token,
    };
  },

  decodeToken: (token) => Buffer.from(token, "base64url"),

  // A COSE token's native form is its BYTES; a reconstructed object is not a token.
  encodeToken: (content) =>
    isBuffer(content)
      ? content.toString("base64url")
      : isString(content)
        ? content
        : undefined,
};
