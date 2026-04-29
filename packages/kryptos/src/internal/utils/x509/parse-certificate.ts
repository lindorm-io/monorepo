import { KryptosError } from "../../../errors/index.js";
import type {
  ParsedX509Certificate,
  ParsedX509Extensions,
} from "../../../types/index.js";
import {
  ASN1_CONTEXT_CONSTRUCTED_BASE,
  ASN1_TAG_BIT_STRING,
  ASN1_TAG_INTEGER,
  ASN1_TAG_SEQUENCE,
  decodeBitString,
  decodeInteger,
  readTlv,
} from "../asn1/index.js";
import { parseX509AlgorithmIdentifier } from "./parse-algorithm-identifier.js";
import { parseX509Extensions } from "./parse-extensions.js";
import { parseX509Name } from "./parse-name.js";
import { parseX509Validity } from "./parse-validity.js";

const EMPTY_EXTENSIONS: ParsedX509Extensions = {
  basicConstraintsCa: false,
  keyUsage: [],
  subjectAltNames: [],
};

export const parseX509Certificate = (der: Buffer): ParsedX509Certificate => {
  const outer = readTlv(der, 0);
  if (outer.tag !== ASN1_TAG_SEQUENCE) {
    throw new KryptosError("Certificate is not a SEQUENCE");
  }

  const outerEnd = outer.contentStart + outer.contentLength;

  // tbsCertificate
  const tbsTlv = readTlv(der, outer.contentStart);
  if (tbsTlv.tag !== ASN1_TAG_SEQUENCE) {
    throw new KryptosError("TBSCertificate is not a SEQUENCE");
  }
  const tbsBytes = Buffer.from(der.subarray(outer.contentStart, tbsTlv.nextOffset));

  // outer signatureAlgorithm
  const sigAlgTlv = readTlv(der, tbsTlv.nextOffset);
  if (sigAlgTlv.tag !== ASN1_TAG_SEQUENCE) {
    throw new KryptosError("Certificate signatureAlgorithm is not a SEQUENCE");
  }
  const sigAlgBytes = der.subarray(tbsTlv.nextOffset, sigAlgTlv.nextOffset);
  const signatureAlgorithm = parseX509AlgorithmIdentifier(sigAlgBytes);

  // signatureValue BIT STRING
  const sigValueTlv = readTlv(der, sigAlgTlv.nextOffset);
  if (sigValueTlv.tag !== ASN1_TAG_BIT_STRING) {
    throw new KryptosError("Certificate signatureValue is not a BIT STRING");
  }
  if (sigValueTlv.nextOffset !== outerEnd) {
    throw new KryptosError("Certificate has trailing bytes");
  }
  const sigValueContent = der.subarray(
    sigValueTlv.contentStart,
    sigValueTlv.contentStart + sigValueTlv.contentLength,
  );
  const { bytes: signatureBytes } = decodeBitString(sigValueContent);

  // Walk TBS
  const tbsEnd = tbsTlv.contentStart + tbsTlv.contentLength;
  let offset = tbsTlv.contentStart;

  // Optional [0] version
  let child = readTlv(der, offset);
  if (child.tag === (ASN1_CONTEXT_CONSTRUCTED_BASE | 0)) {
    offset = child.nextOffset;
    child = readTlv(der, offset);
  }

  // serialNumber INTEGER
  if (child.tag !== ASN1_TAG_INTEGER) {
    throw new KryptosError("TBSCertificate serialNumber is not an INTEGER");
  }
  const serialNumber = decodeInteger(
    der.subarray(child.contentStart, child.contentStart + child.contentLength),
  );
  offset = child.nextOffset;

  // signature AlgorithmIdentifier
  child = readTlv(der, offset);
  if (child.tag !== ASN1_TAG_SEQUENCE) {
    throw new KryptosError("TBSCertificate signature is not a SEQUENCE");
  }
  // RFC 5280 §4.1.1.2: inner TBS signature MUST byte-equal outer signatureAlgorithm.
  const innerSigAlgBytes = der.subarray(offset, child.nextOffset);
  if (!Buffer.from(innerSigAlgBytes).equals(Buffer.from(sigAlgBytes))) {
    throw new KryptosError(
      "Certificate signature algorithm mismatch between outer and inner TBS (RFC 5280 §4.1.1.2)",
    );
  }
  offset = child.nextOffset;

  // issuer Name
  child = readTlv(der, offset);
  if (child.tag !== ASN1_TAG_SEQUENCE) {
    throw new KryptosError("TBSCertificate issuer is not a SEQUENCE");
  }
  const issuer = parseX509Name(Buffer.from(der.subarray(offset, child.nextOffset)));
  offset = child.nextOffset;

  // validity
  child = readTlv(der, offset);
  if (child.tag !== ASN1_TAG_SEQUENCE) {
    throw new KryptosError("TBSCertificate validity is not a SEQUENCE");
  }
  const { notBefore, notAfter } = parseX509Validity(
    Buffer.from(der.subarray(offset, child.nextOffset)),
  );
  offset = child.nextOffset;

  // subject Name
  child = readTlv(der, offset);
  if (child.tag !== ASN1_TAG_SEQUENCE) {
    throw new KryptosError("TBSCertificate subject is not a SEQUENCE");
  }
  const subject = parseX509Name(Buffer.from(der.subarray(offset, child.nextOffset)));
  offset = child.nextOffset;

  // subjectPublicKeyInfo
  child = readTlv(der, offset);
  if (child.tag !== ASN1_TAG_SEQUENCE) {
    throw new KryptosError("TBSCertificate SPKI is not a SEQUENCE");
  }
  const subjectPublicKeyInfo = Buffer.from(der.subarray(offset, child.nextOffset));
  offset = child.nextOffset;

  // Optional issuerUniqueID [1], subjectUniqueID [2], extensions [3]
  let extensions: ParsedX509Extensions = EMPTY_EXTENSIONS;
  while (offset < tbsEnd) {
    child = readTlv(der, offset);
    if (child.tag === (ASN1_CONTEXT_CONSTRUCTED_BASE | 3)) {
      // Unwrap [3] EXPLICIT then parse inner Extensions SEQUENCE.
      const inner = der.subarray(
        child.contentStart,
        child.contentStart + child.contentLength,
      );
      extensions = parseX509Extensions(Buffer.from(inner));
    }
    offset = child.nextOffset;
  }

  return {
    tbsBytes,
    signatureAlgorithm,
    signatureBytes,
    serialNumber,
    issuer,
    subject,
    notBefore,
    notAfter,
    subjectPublicKeyInfo,
    extensions,
  };
};
