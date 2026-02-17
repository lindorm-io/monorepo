import { KryptosError } from "../../../errors";
import { RsaBuffer, RsaModulus } from "../../../types";

type Options = Omit<RsaBuffer, "id" | "algorithm" | "type" | "use">;

const VALID_MODULUS = new Set<number>([1024, 2048, 3072, 4096]);

// Read ASN.1 TLV header: returns tag, content length, and header byte count
const readAsn1 = (
  buf: Buffer,
  offset: number,
): { tag: number; length: number; headerSize: number } => {
  const tag = buf[offset];
  const first = buf[offset + 1];

  if (first < 0x80) {
    return { tag, length: first, headerSize: 2 };
  }

  const numBytes = first & 0x7f;
  let length = 0;
  for (let i = 0; i < numBytes; i++) {
    length = (length << 8) | buf[offset + 2 + i];
  }
  return { tag, length, headerSize: 2 + numBytes };
};

// Extract modulus bit length from PKCS#1 DER-encoded RSA key.
// Private: SEQUENCE { INTEGER(version), INTEGER(modulus), ... }
// Public:  SEQUENCE { INTEGER(modulus), INTEGER(exponent) }
const extractModulusBits = (der: Buffer, isPrivate: boolean): number => {
  let offset = 0;

  // Outer SEQUENCE
  const seq = readAsn1(der, offset);
  offset += seq.headerSize;

  // Private keys have a version INTEGER first — skip it
  if (isPrivate) {
    const version = readAsn1(der, offset);
    offset += version.headerSize + version.length;
  }

  // Modulus INTEGER
  const modulus = readAsn1(der, offset);
  offset += modulus.headerSize;

  // ASN.1 integers may have a leading 0x00 for sign padding
  let modulusBytes = modulus.length;
  if (der[offset] === 0x00) {
    modulusBytes -= 1;
  }

  return modulusBytes * 8;
};

export const modulusSize = (options: Options): RsaModulus => {
  if (!options.privateKey && !options.publicKey) {
    throw new KryptosError("Missing RSA key");
  }

  const bits = options.privateKey
    ? extractModulusBits(options.privateKey, true)
    : extractModulusBits(options.publicKey, false);

  if (!VALID_MODULUS.has(bits)) {
    throw new KryptosError(`Unsupported RSA modulus size: ${bits}`);
  }

  return bits as RsaModulus;
};
