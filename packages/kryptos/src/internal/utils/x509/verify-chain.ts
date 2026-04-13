import { createPublicKey, verify } from "crypto";
import { KryptosError } from "../../../errors";
import { ParsedX509Certificate } from "../../../types";
import {
  X509_OID_ECDSA_WITH_SHA256,
  X509_OID_ECDSA_WITH_SHA384,
  X509_OID_ECDSA_WITH_SHA512,
  X509_OID_ED25519,
  X509_OID_ED448,
  X509_OID_SHA256_WITH_RSA,
  X509_OID_SHA384_WITH_RSA,
  X509_OID_SHA512_WITH_RSA,
} from "./oids";
import { ParsedX509, parseX509 } from "./parse-x509";

const SIG_ALG_HASH: Record<string, string | null> = {
  [X509_OID_SHA256_WITH_RSA]: "sha256",
  [X509_OID_SHA384_WITH_RSA]: "sha384",
  [X509_OID_SHA512_WITH_RSA]: "sha512",
  [X509_OID_ECDSA_WITH_SHA256]: "sha256",
  [X509_OID_ECDSA_WITH_SHA384]: "sha384",
  [X509_OID_ECDSA_WITH_SHA512]: "sha512",
  [X509_OID_ED25519]: null,
  [X509_OID_ED448]: null,
};

const describeCert = (cert: ParsedX509Certificate): string =>
  cert.subject.commonName !== undefined
    ? `CN=${cert.subject.commonName}`
    : cert.serialNumber.toString("hex");

const isWithinValidity = (parsed: ParsedX509, now: Date): boolean =>
  now.getTime() >= parsed.cert.notBefore.getTime() &&
  now.getTime() <= parsed.cert.notAfter.getTime();

const matchesAnchor = (parsed: ParsedX509, anchors: Array<ParsedX509>): boolean =>
  anchors.some((anchor) => anchor.der.equals(parsed.der));

const verifySignature = (child: ParsedX509Certificate, issuerSpki: Buffer): boolean => {
  if (!(child.signatureAlgorithm in SIG_ALG_HASH)) {
    throw new KryptosError(
      `Unsupported certificate signature algorithm OID: ${child.signatureAlgorithm}`,
    );
  }
  const hashName = SIG_ALG_HASH[child.signatureAlgorithm];
  const publicKey = createPublicKey({ key: issuerSpki, format: "der", type: "spki" });
  return verify(hashName, child.tbsBytes, publicKey, child.signatureBytes);
};

export const verifyX509Chain = (
  chain: ReadonlyArray<ParsedX509>,
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
        `Certificate ${describeCert(parsed.cert)} is outside its validity window`,
      );
    }
  }

  for (let i = 1; i < chain.length; i++) {
    if (!chain[i].cert.extensions.basicConstraintsCa) {
      throw new KryptosError(
        `Non-leaf certificate ${describeCert(chain[i].cert)} is not marked as a CA`,
      );
    }
  }

  for (let i = 0; i < chain.length - 1; i++) {
    const current = chain[i];
    const next = chain[i + 1];
    if (!verifySignature(current.cert, next.cert.subjectPublicKeyInfo)) {
      throw new KryptosError(
        `Signature verification failed for ${describeCert(current.cert)} against issuer ${describeCert(next.cert)}`,
      );
    }
  }

  const last = chain[chain.length - 1];
  const lastVerifiableByAnchor = anchors.some((anchor) => {
    if (!isWithinValidity(anchor, now)) return false;
    try {
      return verifySignature(last.cert, anchor.cert.subjectPublicKeyInfo);
    } catch {
      return false;
    }
  });

  if (!matchesAnchor(last, anchors) && !lastVerifiableByAnchor) {
    throw new KryptosError(
      `Top of certificate chain ${describeCert(last.cert)} does not match any trust anchor`,
    );
  }
};
