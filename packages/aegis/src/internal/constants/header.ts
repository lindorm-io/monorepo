import {
  EC_ENC_ALGORITHMS,
  EC_SIG_ALGORITHMS,
  OCT_ENC_DIR_ALGORITHMS,
  OCT_ENC_STD_ALGORITHMS,
  OCT_SIG_ALGORITHMS,
  OKP_ENC_ALGORITHMS,
  OKP_SIG_ALGORITHMS,
  RSA_ENC_ALGORITHMS,
  RSA_SIG_ALGORITHMS,
} from "@lindorm/kryptos";

export const TOKEN_HEADER_ALGORITHMS = [
  ...EC_ENC_ALGORITHMS,
  ...EC_SIG_ALGORITHMS,
  ...OKP_ENC_ALGORITHMS,
  ...OKP_SIG_ALGORITHMS,
  ...RSA_ENC_ALGORITHMS,
  ...RSA_SIG_ALGORITHMS,
  ...OCT_ENC_DIR_ALGORITHMS,
  ...OCT_ENC_STD_ALGORITHMS,
  ...OCT_SIG_ALGORITHMS,
] as const;

export const TOKEN_HEADER_TYPES = [
  // JOSE
  "JWE",
  "JWS",
  "JWT",

  // IANA
  "application/cwt",
  "application/cose; cose-type=cose-encrypt",
  "application/cose; cose-type=cose-mac",
  "application/cose; cose-type=cose-sign",
] as const;
