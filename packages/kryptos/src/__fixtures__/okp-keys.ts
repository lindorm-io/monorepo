import { OkpJwk, OkpString } from "../types";

export const TEST_OKP_KEY_B64: OkpString = {
  id: "ff2a448e-8eb0-59a8-8fc6-0ce23ad07e8f",
  algorithm: "EdDSA",
  curve: "Ed25519",
  privateKey: "MC4CAQAwBQYDK2VwBCIEIBwKJlvoh1ngd9LRd7dtvGOSqW4uZamdvIu0ABD2AkxL",
  publicKey: "MCowBQYDK2VwAyEAGRCwCA6lChosFGMQwxGiHCdzblfvCz0FNiRtTnm1qqc",
  type: "OKP",
  use: "sig",
};

export const TEST_OKP_KEY_JWK: OkpJwk = {
  kid: "6fc93fb6-d40e-52dc-9606-adaa80fef0c7",
  alg: "EdDSA",
  x: "eTgk2sA8y7_9q8MjEPskpM4mAUZqtXmwEiHwy249kj4",
  crv: "Ed25519",
  kty: "OKP",
  d: "CDqMp2HAyaLiV8Xdt8ouEnhYbZtRXlFAsEkccUCcpQk",
  use: "sig",
};

export const TEST_OKP_KEY_PEM: OkpString = {
  id: "3ee7c51b-e879-554e-ae49-e6330610f09e",
  algorithm: "EdDSA",
  curve: "Ed25519",
  publicKey:
    "-----BEGIN PUBLIC KEY-----\n" +
    "MCowBQYDK2VwAyEAFqCTfRe3gmMUYSmAmAl8id+ZYSsmFpKHXmh+ZOaPOfM=\n" +
    "-----END PUBLIC KEY-----\n",
  type: "OKP",
  privateKey:
    "-----BEGIN PRIVATE KEY-----\n" +
    "MC4CAQAwBQYDK2VwBCIEIA5gn8ikyFzW8+jNHtl4CvQvLSC2xXJVKTqsdY49bwma\n" +
    "-----END PRIVATE KEY-----\n",
  use: "sig",
};
