import { KryptosError } from "../../../errors";
import { KryptosAlgorithm, KryptosType } from "../../../types";
import { encodeNull, encodeOid, encodeSequence } from "../asn1";
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

export type X509SignatureContext = {
  algorithm: KryptosAlgorithm;
  keyType: KryptosType;
  okpCurve?: "Ed25519" | "Ed448";
};

export type X509SignatureDescriptor = {
  oid: string;
  hashName: string | null;
  nodeSignAlgorithm: "rsa" | "ecdsa" | "ed25519" | "ed448";
  includeNullParams: boolean;
};

export const resolveSignatureDescriptor = (
  context: X509SignatureContext,
): X509SignatureDescriptor => {
  const { algorithm, keyType, okpCurve } = context;

  if (algorithm === "PS256" || algorithm === "PS384" || algorithm === "PS512") {
    throw new KryptosError(
      `RSA-PSS signatures (${algorithm}) for X.509 are not yet supported`,
    );
  }

  if (keyType === "RSA") {
    if (algorithm === "RS256") {
      return {
        oid: X509_OID_SHA256_WITH_RSA,
        hashName: "sha256",
        nodeSignAlgorithm: "rsa",
        includeNullParams: true,
      };
    }
    if (algorithm === "RS384") {
      return {
        oid: X509_OID_SHA384_WITH_RSA,
        hashName: "sha384",
        nodeSignAlgorithm: "rsa",
        includeNullParams: true,
      };
    }
    if (algorithm === "RS512") {
      return {
        oid: X509_OID_SHA512_WITH_RSA,
        hashName: "sha512",
        nodeSignAlgorithm: "rsa",
        includeNullParams: true,
      };
    }
  }

  if (keyType === "EC") {
    if (algorithm === "ES256") {
      return {
        oid: X509_OID_ECDSA_WITH_SHA256,
        hashName: "sha256",
        nodeSignAlgorithm: "ecdsa",
        includeNullParams: false,
      };
    }
    if (algorithm === "ES384") {
      return {
        oid: X509_OID_ECDSA_WITH_SHA384,
        hashName: "sha384",
        nodeSignAlgorithm: "ecdsa",
        includeNullParams: false,
      };
    }
    if (algorithm === "ES512") {
      return {
        oid: X509_OID_ECDSA_WITH_SHA512,
        hashName: "sha512",
        nodeSignAlgorithm: "ecdsa",
        includeNullParams: false,
      };
    }
  }

  if (keyType === "OKP" && algorithm === "EdDSA") {
    if (okpCurve === "Ed448") {
      return {
        oid: X509_OID_ED448,
        hashName: null,
        nodeSignAlgorithm: "ed448",
        includeNullParams: false,
      };
    }
    return {
      oid: X509_OID_ED25519,
      hashName: null,
      nodeSignAlgorithm: "ed25519",
      includeNullParams: false,
    };
  }

  throw new KryptosError(
    `Unsupported X.509 signature combination: type=${keyType} algorithm=${algorithm}`,
  );
};

export const encodeX509AlgorithmIdentifier = (
  descriptor: X509SignatureDescriptor,
): Buffer => {
  const children: Array<Buffer> = [encodeOid(descriptor.oid)];
  if (descriptor.includeNullParams) {
    children.push(encodeNull());
  }
  return encodeSequence(children);
};
