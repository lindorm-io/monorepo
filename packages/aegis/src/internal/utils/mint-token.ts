import { isObject } from "@lindorm/is";
import { omitUndefined } from "@lindorm/utils";
import { AegisDomainError } from "../../errors/index.js";
import type {
  ProfileMintOptions,
  SignContent,
  SignedJwt,
  SignJwtContent,
} from "../../types/index.js";
import { domainToJose } from "../claims/translate.js";
import { resolveProfile } from "../profiles/registry.js";
import type { AegisDeps } from "./aegis-deps.js";
import { assembleCommonClaims } from "./assemble-common-claims.js";
import { encryptJwe } from "./encrypt-jwe.js";
import { withSensitiveDomain } from "./jwt-payload.js";
import { mintCoseToken } from "./mint-cose-token.js";
import { selectEncoder } from "./select-encoder.js";
import { signJwtWire } from "./sign-jwt-wire.js";
import { validateProfileClaims } from "./validate-profile-claims.js";

/**
 * The profiled mint pipeline (`aegis.mint`). Dispatches on the per-call format:
 * the profiled COSE path (`cwt`) is a separate encoder (`mintCoseToken`) that
 * consumes the same domain-keyed common claims; the JOSE path assembles +
 * validates the DOMAIN-keyed common layer, maps it to JOSE wire via the ONE
 * translator, signs, and optionally sign-then-encrypts.
 */
export const mintToken = async ({
  name,
  content,
  options,
  deps,
}: {
  name: string;
  content: SignContent;
  options: ProfileMintOptions;
  deps: AegisDeps;
}): Promise<SignedJwt> => {
  // Encoding seam: dispatch on the per-call format. The profiled COSE path
  // (`cwt`) is a separate encoder that consumes the same domain-keyed common
  // claims; everything above this branch stays encoding-neutral.
  if (selectEncoder(options.format).format === "cwt") {
    return mintCoseToken({ name, content, options, deps });
  }

  const profile = resolveProfile(name);

  // T5 — `options.encrypt` is only meaningful for encryptable profiles.
  // Passing it for a non-encryptable profile (access_token / SET / logout /
  // erasure / DPoP) is a caller error, not a silent no-op.
  if (options.encrypt !== undefined && !profile.encryptable) {
    throw new AegisDomainError("Encryption is not allowed for this profile", {
      code: "encryption_not_allowed",
      data: { profile: profile.name },
      title: "Encryption Not Allowed",
      details:
        "This token profile is not encryptable, so an encrypt option cannot be supplied; remove it or use an encryptable profile.",
    });
  }

  // The profile's algClass is part of the signing FLOOR, so the right class of
  // key is SELECTED here rather than the wrong one being caught afterwards.
  const kryptos = await deps.resolveSignKey(options.sign ?? {}, profile);

  // T5 — resolve the recipient (client) enc key when encryption is in play.
  // Encryption fires when the profile is encryptable AND either an explicit
  // `encrypt` option is supplied OR the content carries `sensitive` fields
  // (forced within id_token). When no enc key is resolvable, encryption is
  // skipped and any sensitive fields are omitted (never emitted in clear).
  const hasSensitive = content.sensitive != null;
  const explicitEncrypt = options.encrypt !== undefined;
  const wantsEncryption = profile.encryptable && (explicitEncrypt || hasSensitive);

  // When the caller explicitly asked for encryption, a missing enc key is a
  // hard error. When encryption is forced ONLY by the sensitive fields, a
  // missing key is tolerated — they are omitted instead (see below).
  const encKryptos = wantsEncryption
    ? await deps.resolveEncKey(options.encrypt?.key, explicitEncrypt)
    : undefined;

  // The sensitive fields MUST NOT travel in cleartext. If they cannot be
  // encrypted (profile not encryptable, or no enc key resolvable), strip them
  // from the content before signing so they are omitted entirely.
  const signContent =
    hasSensitive && !encKryptos
      ? (omitUndefined({ ...content, sensitive: undefined }) as SignContent)
      : content;

  // Assemble + validate on the DOMAIN-keyed common layer: presence/forbid/
  // conditional policy (inside assembleCommonClaims) + the structural RFC
  // rules (validateProfileClaims). Business logic lives in domain terms.
  const common = assembleCommonClaims(
    { algorithm: kryptos.algorithm, issuer: deps.issuer, lifetime: options.lifetime },
    profile,
    signContent,
    { ...(options.sign ?? {}), context: options.context },
  );

  validateProfileClaims(profile, common, {
    ...(options.context ?? {}),
    algorithm: kryptos.algorithm as any,
  });

  // JOSE wire claims via the ONE translator. `common` already carries the
  // resolved envelope (iss/iat/jti/nbf/exp) and the custom claims, so the
  // signed token matches the validated common layer exactly — one source of
  // truth. Profile + FLAT sensitive claims join the domain layer so
  // `domainToJose` maps each by the registry (the sensitive fields become their
  // individual wire claims, not a nested wrapper); the emit boundary makes no
  // case decision (R18).
  const claims = domainToJose(
    withSensitiveDomain(
      isObject(signContent.profile) ? { ...common, ...signContent.profile } : common,
      signContent,
    ),
  );

  // A profile typ value stamps the header verbatim (e.g. `at+jwt`) — for
  // BOTH optional and required presence (presence is a verify-side knob
  // only). Presence `none` means "none mandated": fall back to the
  // tokenType-derived default (bare `JWT` when no tokenType), which JwtKit
  // requires as a header floor.
  const signed = signJwtWire({
    kryptos,
    wireClaims: claims,
    content: signContent as SignJwtContent,
    options: {
      ...(options.sign ?? {}),
      // mint's own `omit` controls the wire; a per-sign omit is a fallback.
      omit: options.omit ?? options.sign?.omit,
      ...(profile.typ.presence !== "none" ? { typ: profile.typ.value } : {}),
    },
    certBindingMode: deps.certBindingMode,
    clockTolerance: deps.clockTolerance,
    logger: deps.logger,
  });

  if (!encKryptos) {
    return signed;
  }

  // T5 — sign-then-encrypt. The inner signed JWT keeps the profile typ
  // (`at+jwt` / bare `JWT`); the outer JWE carries `cty: application/jwt`
  // (set automatically by JweKit.encrypt from the inner-token shape). The
  // read side (verify recursion) decrypts then verifies the inner JWT,
  // applying the profile floor to the inner claims/typ.
  const { token } = encryptJwe({
    kryptos: encKryptos,
    data: signed.token,
    encryption: options.encrypt?.key?.encryption ?? deps.encryption,
    certBindingMode: deps.certBindingMode,
    logger: deps.logger,
  });

  return { ...signed, token };
};
