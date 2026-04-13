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
import { parseX509Certificate } from "./parse-certificate";
import { parseX509 } from "./parse-x509";

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

type ParsedEntry = {
  der: Buffer;
  cert: ParsedX509Certificate;
};

const parseEntry = (der: Buffer): ParsedEntry => {
  try {
    return { der, cert: parseX509Certificate(der) };
  } catch (err: any) {
    throw new KryptosError("Failed to parse X.509 certificate", { error: err });
  }
};

const describeCert = (cert: ParsedX509Certificate): string =>
  cert.subject.commonName !== undefined
    ? `CN=${cert.subject.commonName}`
    : cert.serialNumber.toString("hex");

const isWithinValidity = (cert: ParsedX509Certificate, now: Date): boolean =>
  now.getTime() >= cert.notBefore.getTime() && now.getTime() <= cert.notAfter.getTime();

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

const toDerArray = (
  trustAnchors: string | Array<string> | ReadonlyArray<Buffer>,
): Array<Buffer> => {
  if (typeof trustAnchors === "string") return parseX509(trustAnchors);
  if (trustAnchors.length === 0) return [];
  if (typeof trustAnchors[0] === "string")
    return parseX509(trustAnchors as Array<string>);
  return [...(trustAnchors as ReadonlyArray<Buffer>)];
};

export const verifyX509Chain = (
  chain: ReadonlyArray<Buffer>,
  trustAnchors: string | Array<string> | ReadonlyArray<Buffer>,
): void => {
  // Pragmatic chain validation only: signature walk, validity window, basic
  // constraints CA on non-leaf, anchor match by DER equality. Revocation
  // (OCSP/CRL) and full RFC 5280 policy validation are explicitly out of scope.

  if (chain.length === 0) {
    throw new KryptosError("Certificate chain is empty");
  }

  const parsedChain = chain.map(parseEntry);

  const anchorDers = toDerArray(trustAnchors);

  if (anchorDers.length === 0) {
    throw new KryptosError("At least one trust anchor is required");
  }

  const anchors = anchorDers.map(parseEntry);

  const now = new Date();

  for (const parsed of parsedChain) {
    if (!isWithinValidity(parsed.cert, now)) {
      throw new KryptosError(
        `Certificate ${describeCert(parsed.cert)} is outside its validity window`,
      );
    }
  }

  for (let i = 1; i < parsedChain.length; i++) {
    if (!parsedChain[i].cert.extensions.basicConstraintsCa) {
      throw new KryptosError(
        `Non-leaf certificate ${describeCert(parsedChain[i].cert)} is not marked as a CA`,
      );
    }
  }

  for (let i = 0; i < parsedChain.length - 1; i++) {
    const current = parsedChain[i];
    const next = parsedChain[i + 1];
    if (!verifySignature(current.cert, next.cert.subjectPublicKeyInfo)) {
      throw new KryptosError(
        `Signature verification failed for ${describeCert(current.cert)} against issuer ${describeCert(next.cert)}`,
      );
    }
  }

  const last = parsedChain[parsedChain.length - 1];
  const matchesAnchor = anchors.some((anchor) => anchor.der.equals(last.der));
  const lastVerifiableByAnchor = anchors.some((anchor) => {
    if (!isWithinValidity(anchor.cert, now)) return false;
    try {
      return verifySignature(last.cert, anchor.cert.subjectPublicKeyInfo);
    } catch {
      return false;
    }
  });

  if (!matchesAnchor && !lastVerifiableByAnchor) {
    throw new KryptosError(
      `Top of certificate chain ${describeCert(last.cert)} does not match any trust anchor`,
    );
  }
};
