import { KryptosB64, KryptosJwk, KryptosPem } from "../types";

export const TEST_OKP_KEY_B64: KryptosB64 = {
  curve: "Ed25519",
  privateKey: "MC4CAQAwBQYDK2VwBCIEIBwKJlvoh1ngd9LRd7dtvGOSqW4uZamdvIu0ABD2AkxL",
  publicKey: "MCowBQYDK2VwAyEAGRCwCA6lChosFGMQwxGiHCdzblfvCz0FNiRtTnm1qqc",
  type: "OKP",
};

export const TEST_OKP_KEY_JWK: KryptosJwk = {
  x: "eTgk2sA8y7_9q8MjEPskpM4mAUZqtXmwEiHwy249kj4",
  crv: "Ed25519",
  kty: "OKP",
  d: "CDqMp2HAyaLiV8Xdt8ouEnhYbZtRXlFAsEkccUCcpQk",
};

export const TEST_OKP_KEY_PEM: KryptosPem = {
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
};
