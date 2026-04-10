import { DpopSigner, Jwks, JwksAlgorithm } from "@lindorm/types";

// Produce a DpopSigner from a non-extractable Web Crypto key pair.
// The private key stays in the browser's key store — only the public
// JWK leaves it (embedded in the DPoP proof header) and only signature
// bytes come out of it (via crypto.subtle.sign).
//
// Supported algorithms mirror what browsers can natively sign:
//   ECDSA P-256/384/521 -> ES256 / ES384 / ES512
//   RSASSA-PKCS1-v1_5 with SHA-256/384/512 -> RS256 / RS384 / RS512
//   RSA-PSS with SHA-256/384/512 -> PS256 / PS384 / PS512
//
// https://datatracker.ietf.org/doc/html/rfc9449

type AnyKeyAlgorithm = KeyAlgorithm & {
  namedCurve?: string;
  hash?: { name: string } | string;
};

const deriveJoseAlgorithm = (algorithm: AnyKeyAlgorithm): JwksAlgorithm => {
  switch (algorithm.name) {
    case "ECDSA": {
      switch (algorithm.namedCurve) {
        case "P-256":
          return "ES256";
        case "P-384":
          return "ES384";
        case "P-521":
          return "ES512";
        default:
          throw new Error(`Unsupported ECDSA curve: ${String(algorithm.namedCurve)}`);
      }
    }
    case "RSASSA-PKCS1-v1_5":
    case "RSA-PSS": {
      const hashName =
        typeof algorithm.hash === "string" ? algorithm.hash : algorithm.hash?.name;
      const prefix = algorithm.name === "RSA-PSS" ? "PS" : "RS";
      switch (hashName) {
        case "SHA-256":
          return `${prefix}256` as JwksAlgorithm;
        case "SHA-384":
          return `${prefix}384` as JwksAlgorithm;
        case "SHA-512":
          return `${prefix}512` as JwksAlgorithm;
        default:
          throw new Error(`Unsupported RSA hash: ${String(hashName)}`);
      }
    }
    default:
      throw new Error(`Unsupported DPoP signing algorithm: ${algorithm.name}`);
  }
};

const subtleSignParams = (
  algorithm: AnyKeyAlgorithm,
): AlgorithmIdentifier | RsaPssParams | EcdsaParams => {
  switch (algorithm.name) {
    case "ECDSA": {
      const hashName =
        algorithm.namedCurve === "P-256"
          ? "SHA-256"
          : algorithm.namedCurve === "P-384"
            ? "SHA-384"
            : "SHA-512";
      return { name: "ECDSA", hash: { name: hashName } };
    }
    case "RSA-PSS":
      return { name: "RSA-PSS", saltLength: 32 };
    case "RSASSA-PKCS1-v1_5":
      return { name: "RSASSA-PKCS1-v1_5" };
    default:
      throw new Error(`Unsupported DPoP signing algorithm: ${algorithm.name}`);
  }
};

export const webCryptoToDpopSigner = async (
  keyPair: CryptoKeyPair,
): Promise<DpopSigner> => {
  const privateAlgorithm = keyPair.privateKey.algorithm as AnyKeyAlgorithm;

  const algorithm = deriveJoseAlgorithm(privateAlgorithm);
  const publicJwk = (await crypto.subtle.exportKey("jwk", keyPair.publicKey)) as Jwks;
  const signParams = subtleSignParams(privateAlgorithm);

  return {
    algorithm,
    publicJwk,
    sign: async (data: Uint8Array): Promise<Uint8Array> => {
      const signature = await crypto.subtle.sign(
        signParams,
        keyPair.privateKey,
        data as BufferSource,
      );
      return new Uint8Array(signature);
    },
  };
};
