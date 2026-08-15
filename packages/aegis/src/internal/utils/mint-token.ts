import { AegisDomainError } from "../../errors/index.js";
import type { ProfileMintOptions, SignContent, SignedToken } from "../../types/index.js";
import { enforcePolicy } from "../profiles/enforce-policy.js";
import { assertWireInput } from "../wire/assert-wire-input.js";
import type { SignClaimsInput } from "../wire/token-wire.js";
import { tokenWireFor } from "../wire/token-wire-for.js";
import type { AegisDeps } from "./aegis-deps.js";
import { assembleCommonClaims } from "./assemble-common-claims.js";
import { domainHeaderToWire } from "./domain-header-to-wire.js";
import { encryptOuter } from "./encrypt-outer.js";
import { mergeContentClaims } from "./merge-content-claims.js";
import { findSensitiveClaims, stripSensitiveClaims } from "./sensitive-content.js";

/**
 * THE profiled mint pipeline (`aegis.mint`). One implementation for every wire:
 * the profile is resolved, its policy enforced, the DOMAIN-keyed common claims
 * assembled and validated, and only then is the token handed to the wire that
 * emits it.
 *
 * It was two encoders sharing a dispatch. What genuinely differed between them:
 * both profile guards were written out twice, the token-type derivation differed
 * (and still does — see `TokenWire.mintTypPrefix`), each resolved its signing and
 * encryption keys in its own order, and the COSE one hardcoded `objectId:
 * undefined` on its result even though the header parameter reached the wire. The
 * claim buckets and the header bag were ALREADY shared by an earlier step; this
 * step did not repair those and must not be read as having done so. What it does
 * add is that everything above `wire.signClaims` is now encoding-neutral by
 * construction: there is no second place left for a rule to be written
 * differently.
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
}): Promise<SignedToken> => {
  const profile = deps.resolveProfile(name);
  const format = options.format ?? "jwt";
  const wire = tokenWireFor(format);

  // A profile declares the DIRECTION it is used in. A verify-only one exists to
  // check ANOTHER issuer's token, so minting it would emit that artifact under
  // OUR signature — a degraded token of a kind we are not entitled to issue.
  // `ProfileContentFor` resolves such a name to `never`, so a typechecked caller
  // never reaches this; the throw covers the untyped and cast-past-it ones.
  if (profile.use === "verify") {
    throw new AegisDomainError("Profile cannot be minted", {
      code: "profile_not_mintable",
      data: { profile: profile.name, use: profile.use, format },
      title: "Profile Not Mintable",
      details:
        "This token profile declares itself verify-only: it exists to verify a token issued elsewhere, so it cannot be used to mint one. Use the profile that owns the artifact you are issuing.",
    });
  }

  // `options.encrypt` is only meaningful for an encryptable profile. Passing it
  // for one that is not is a caller error, not a silent no-op.
  if (options.encrypt !== undefined && !profile.encryptable) {
    throw new AegisDomainError("Encryption is not allowed for this profile", {
      code: "encryption_not_allowed",
      data: { profile: profile.name, format },
      title: "Encryption Not Allowed",
      details:
        "This token profile is not encryptable, so an encrypt option cannot be supplied; remove it or use an encryptable profile.",
    });
  }

  // The profile's algClass is part of the signing FLOOR, so the right class of
  // key is SELECTED here rather than the wrong one being caught afterwards — and
  // `resolveKey` applies that floor to EVERY key it returns, an injected one
  // (a client secret handed in through `sign.key`) included. That is the whole
  // mint-side enforcement; the profile policy below is about CLAIMS only.
  const kryptos = await deps.resolveSignKey(options.sign ?? {}, profile);

  // Confidentiality is decided by the CLAIM REGISTRY, never by the container the
  // caller reached for: encryption fires when the profile is encryptable AND
  // either the caller asked for it or the content carries a claim the registry
  // marks sensitive — wherever in the content that claim sits.
  const sensitive = findSensitiveClaims(content);
  const explicitEncrypt = options.encrypt !== undefined;
  const wantsEncryption =
    profile.encryptable && (explicitEncrypt || sensitive.length > 0);

  // When the caller explicitly asked for encryption, a missing recipient key is a
  // hard error. When encryption is forced ONLY by a sensitive claim, a missing key
  // is tolerated — the claim is omitted instead (below).
  const encKryptos = wantsEncryption
    ? await deps.resolveEncKey(options.encrypt?.key, explicitEncrypt)
    : undefined;

  // A sensitive claim MUST NOT travel in cleartext. If it cannot be encrypted,
  // strip it before signing so it is omitted from the token entirely.
  const signContent =
    sensitive.length > 0 && !encKryptos
      ? stripSensitiveClaims(content, sensitive)
      : content;

  // Assemble the DOMAIN-keyed common layer, then enforce the profile's WHOLE
  // policy over it in ONE call — the same call the verify floor makes, with the
  // direction as its only difference. Business logic lives in domain terms,
  // above every wire.
  const common = assembleCommonClaims(
    { algorithm: kryptos.algorithm, issuer: deps.issuer, lifetime: options.lifetime },
    profile,
    signContent,
    options.sign ?? {},
  );

  enforcePolicy({
    claims: common,
    context: options.context ?? {},
    direction: "mint",
    format,
    profile,
  });

  const tokenType = wire.mintTypPrefix({
    profile,
    contentTokenType: signContent.tokenType,
    signTyp: options.sign?.typ,
    format,
  });

  // The DOMAIN → WIRE assembly, done ONCE above the seam: the header bag is
  // translated here rather than by each wire (both ran the identical
  // `domainHeaderToWire` pass, which is duplication sitting exactly where the
  // drops happened), and every value below is the CALLER's own — no deployment
  // default is filled in, because the guard reads caller INTENT and a default is
  // not a request.
  const signInput: SignClaimsInput = {
    kryptos,
    deps,
    // The profile and sensitive buckets join the domain layer here, AFTER policy
    // has run over `common`: neither carries profile policy, and both map to
    // individual wire claims rather than a nested wrapper.
    common: mergeContentClaims(common, signContent),
    format,
    tokenType,
    header: domainHeaderToWire(options.sign?.header),
    proprietary: options.proprietary,
    bindCertificate: options.sign?.bindCertificate,
    certificateThumbprintSha1: options.sign?.certificateThumbprintSha1,
  };

  assertWireInput(wire.dispositions.signClaims, signInput, {
    format,
    operation: "signClaims",
  });

  const signed = wire.signClaims(signInput);

  if (!encKryptos) return signed;

  // Sign-then-encrypt. The inner signed token keeps the profile's type; the outer
  // declares a nested token so the read side reconstructs the plaintext to the
  // inner token rather than to an inferred blob, then decrypts-then-verifies it
  // against the profile floor.
  const token = encryptOuter(wire, {
    kryptos: encKryptos,
    deps,
    inner: signed.token,
    innerTokenType: tokenType,
    proprietary: options.proprietary,
    partyProducer: options.encrypt?.partyProducer,
    partyRecipient: options.encrypt?.partyRecipient,
    certificateThumbprintSha1: options.encrypt?.certificateThumbprintSha1,
  });

  // The OUTER wire is now the encrypting format, mirroring the read side — which
  // reports that outer with the signed inner's format under `inner`.
  return { ...signed, token, format: wire.encryptedFormat };
};
