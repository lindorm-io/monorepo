import { KryptosError } from "../../../errors";
import { ParsedX509, parseX509 } from "./parse-x509";

const isWithinValidity = (parsed: ParsedX509, now: Date): boolean => {
  const notBefore = new Date(parsed.cert.validFrom);
  const notAfter = new Date(parsed.cert.validTo);
  return now.getTime() >= notBefore.getTime() && now.getTime() <= notAfter.getTime();
};

const matchesAnchor = (parsed: ParsedX509, anchors: Array<ParsedX509>): boolean =>
  anchors.some((anchor) => anchor.der.equals(parsed.der));

export const verifyX509Chain = (
  chain: Array<ParsedX509>,
  trustAnchors: string | Array<ParsedX509> | Array<string>,
): void => {
  // Pragmatic chain validation only: signature walk, validity window, basic
  // constraints CA on non-leaf, anchor match by DER equality. Revocation
  // (OCSP/CRL) and full RFC 5280 policy validation are explicitly out of scope.

  if (chain.length === 0) {
    throw new KryptosError("Certificate chain is empty");
  }

  const anchors: Array<ParsedX509> = Array.isArray(trustAnchors)
    ? trustAnchors.length > 0 && typeof (trustAnchors as Array<unknown>)[0] === "string"
      ? parseX509(trustAnchors as Array<string>)
      : (trustAnchors as Array<ParsedX509>)
    : parseX509(trustAnchors);

  if (anchors.length === 0) {
    throw new KryptosError("At least one trust anchor is required");
  }

  const now = new Date();

  for (const parsed of chain) {
    if (!isWithinValidity(parsed, now)) {
      throw new KryptosError(
        `Certificate ${parsed.cert.subject} is outside its validity window`,
      );
    }
  }

  for (let i = 1; i < chain.length; i++) {
    if (!chain[i].cert.ca) {
      throw new KryptosError(
        `Non-leaf certificate ${chain[i].cert.subject} is not marked as a CA`,
      );
    }
  }

  for (let i = 0; i < chain.length - 1; i++) {
    const current = chain[i];
    const next = chain[i + 1];
    if (!current.cert.verify(next.cert.publicKey)) {
      throw new KryptosError(
        `Signature verification failed for ${current.cert.subject} against issuer ${next.cert.subject}`,
      );
    }
  }

  const last = chain[chain.length - 1];
  const lastVerifiableByAnchor = anchors.some((anchor) => {
    if (!isWithinValidity(anchor, now)) return false;
    try {
      return last.cert.verify(anchor.cert.publicKey);
    } catch {
      return false;
    }
  });

  if (!matchesAnchor(last, anchors) && !lastVerifiableByAnchor) {
    throw new KryptosError(
      `Top of certificate chain ${last.cert.subject} does not match any trust anchor`,
    );
  }
};
