import { createPrivateKey, createPublicKey } from "crypto";
import { JwkError } from "../../errors";
import { RsaJwkValues, RsaPemValues } from "../../types";
import { Asn1SequenceDecoder } from "./Asn1SequenceDecoder";
import { Asn1SequenceEncoder } from "./Asn1SequenceEncoder";

export const createRsaJwk = ({ privateKey, publicKey, type }: RsaPemValues): RsaJwkValues => {
  if (!publicKey) {
    throw new JwkError(`Invalid publicKey [ ${publicKey} ]`);
  }

  if (!privateKey) {
    const key = createPublicKey({
      key: publicKey,
      format: "pem",
      type: "pkcs1",
    });
    const der = key.export({ format: "der", type: "pkcs1" });
    const dec = new Asn1SequenceDecoder(der);

    const n = dec.unsignedInteger().toString("base64");
    const e = dec.unsignedInteger().toString("base64");

    dec.end();

    return {
      n,
      e,
      kty: type,
    };
  }

  if (privateKey) {
    const key = createPrivateKey({
      key: privateKey,
      format: "pem",
      type: "pkcs8",
      passphrase: "",
    });
    const der = key.export({ format: "der", type: "pkcs1" });
    const dec = new Asn1SequenceDecoder(der);

    dec.unsignedInteger();
    dec.unsignedInteger();
    dec.unsignedInteger();

    const d = dec.unsignedInteger().toString("base64");
    const p = dec.unsignedInteger().toString("base64");
    const q = dec.unsignedInteger().toString("base64");
    const dp = dec.unsignedInteger().toString("base64");
    const dq = dec.unsignedInteger().toString("base64");
    const qi = dec.unsignedInteger().toString("base64");

    dec.end();

    return {
      ...createRsaJwk({ publicKey, type }),
      d,
      p,
      q,
      dp,
      dq,
      qi,
    };
  }

  throw new JwkError("publicKey is required");
};

export const createRsaPem = ({ d, dp, dq, e, n, p, q, qi, kty }: RsaJwkValues): RsaPemValues => {
  const isPrivate = d !== undefined;

  const enc = new Asn1SequenceEncoder();
  const modulus = Buffer.from(n, "base64");
  const exponent = Buffer.from(e, "base64");

  if (!isPrivate) {
    enc.unsignedInteger(modulus);
    enc.unsignedInteger(exponent);

    const der = enc.end();
    const key = createPublicKey({
      key: der,
      format: "der",
      type: "pkcs1",
    });
    const publicKey = key.export({ format: "pem", type: "pkcs1" }) as string;

    return { publicKey, type: kty };
  }

  if (!d) {
    throw new JwkError("JWK key [ d ] invalid (empty)");
  }

  if (!p) {
    throw new JwkError("JWK key [ p ] invalid (empty)");
  }

  if (!q) {
    throw new JwkError("JWK key [ q ] invalid (empty)");
  }

  if (!dp) {
    throw new JwkError("JWK key [ dp ] invalid (empty)");
  }

  if (!dq) {
    throw new JwkError("JWK key [ dq ] invalid (empty)");
  }

  if (!qi) {
    throw new JwkError("JWK key [ qi ] invalid (empty)");
  }

  enc.zero();
  enc.unsignedInteger(modulus);
  enc.unsignedInteger(exponent);
  enc.unsignedInteger(Buffer.from(d, "base64"));
  enc.unsignedInteger(Buffer.from(p, "base64"));
  enc.unsignedInteger(Buffer.from(q, "base64"));
  enc.unsignedInteger(Buffer.from(dp, "base64"));
  enc.unsignedInteger(Buffer.from(dq, "base64"));
  enc.unsignedInteger(Buffer.from(qi, "base64"));

  const der = enc.end();
  const key = createPrivateKey({
    key: der,
    format: "der",
    type: "pkcs1",
  });
  const privateKey = key.export({ format: "pem", type: "pkcs1" }) as string;

  return {
    ...createRsaPem({ e, n, kty }),
    privateKey,
  };
};
