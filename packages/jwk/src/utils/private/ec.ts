import { createPrivateKey, createPublicKey } from "crypto";
import { JwkError } from "../../errors";
import { EcJwkValues, EcPemValues, EllipticCurve } from "../../types";
import { Asn1SequenceEncoder } from "./Asn1SequenceEncoder";

const getCurveLength = (
  curve: EllipticCurve,
): { len: number; offset: number; correction: number } => {
  switch (curve) {
    case "P-256":
      return {
        len: 64,
        offset: 34 + 2,
        correction: -1,
      };

    case "P-384":
      return {
        len: 96,
        offset: 33 + 2,
        correction: -3,
      };

    case "P-521":
      return {
        len: 132,
        offset: 33 + 2,
        correction: -3,
      };

    default:
      throw new JwkError("Unsupported curve");
  }
};

export const createEcJwk = ({ curve, privateKey, publicKey, type }: EcPemValues): EcJwkValues => {
  if (!curve) {
    throw new JwkError(`Invalid curve [ ${curve} ]`);
  }

  if (!publicKey) {
    throw new JwkError(`Invalid publicKey [ ${publicKey} ]`);
  }

  const { len, offset: originalOffset, correction } = getCurveLength(curve);
  let offset = originalOffset;

  if (!privateKey) {
    const key = createPublicKey(publicKey);
    const der = key.export({ format: "der", type: "spki" });

    return {
      crv: curve,
      x: der.subarray(-len, -len / 2).toString("base64"),
      y: der.subarray(-len / 2).toString("base64"),
      kty: type,
    };
  }

  if (privateKey) {
    const key = createPrivateKey(privateKey);
    const der = key.export({ format: "der", type: "pkcs8" });

    if (der.length < 100) {
      offset += correction;
    }

    return {
      ...createEcJwk({ curve, publicKey, type }),
      d: der.subarray(offset, offset + len / 2).toString("base64"),
    };
  }

  throw new JwkError("Unexpected Error");
};

export const createEcPem = ({ crv, d, x, y, kty }: EcJwkValues): EcPemValues => {
  const isPrivate = d !== undefined;

  if (!x) {
    throw new JwkError("JWK key [ x ] invalid (empty)");
  }

  if (!y) {
    throw new JwkError("JWK key [ y ] invalid (empty)");
  }

  const enc = new Asn1SequenceEncoder();
  const pub = Buffer.concat([
    Buffer.alloc(1, 4),
    Buffer.from(x, "base64"),
    Buffer.from(y, "base64"),
  ]);

  if (!isPrivate) {
    const enc$1 = new Asn1SequenceEncoder();

    enc$1.oidFor("ecPublicKey");
    enc$1.oidFor(crv);
    enc.add(enc$1.end());
    enc.bitStr(pub);

    const der = enc.end();
    const key = createPublicKey({ key: der, format: "der", type: "spki" });
    const publicKey = key.export({ format: "pem", type: "spki" }) as string;

    return { curve: crv, publicKey, type: kty };
  }

  enc.zero();

  if (!d) {
    throw new JwkError("JWK key [ d ] invalid (empty)");
  }

  const enc$1 = new Asn1SequenceEncoder();
  enc$1.oidFor("ecPublicKey");
  enc$1.oidFor(crv);
  enc.add(enc$1.end());

  const enc$2 = new Asn1SequenceEncoder();
  enc$2.one();
  enc$2.octStr(Buffer.from(d, "base64"));

  const enc$3 = new Asn1SequenceEncoder();
  enc$3.bitStr(pub);

  const f2 = enc$3.end(Buffer.from([0xa1]));
  enc$2.add(f2);

  const f = enc$2.end();
  const enc$4 = new Asn1SequenceEncoder();
  enc$4.add(f);

  const f3 = enc$4.end(Buffer.from([0x04]));
  enc.add(f3);

  const der = enc.end();
  const key = createPrivateKey({ key: der, format: "der", type: "pkcs8" });
  const privateKey = key.export({ format: "pem", type: "pkcs8" }) as string;

  return {
    ...createEcPem({ x, y, crv, kty }),
    privateKey,
  };
};
