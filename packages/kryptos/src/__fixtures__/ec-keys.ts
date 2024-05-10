import { KryptosB64, KryptosJwk, KryptosPem, KryptosRaw } from "../types";

export const TEST_EC_KEY_B64: KryptosB64 = {
  curve: "P-521",
  privateKey:
    "MIHuAgEAMBAGByqGSM49AgEGBSuBBAAjBIHWMIHTAgEBBEIATAYo3DQYroDV5EgJSUs_kOIvnEScZen73gXa5oQkub0ekQmgOJdPQjINUsdYRn67QK_oBdNUhVbtG_qdxqIgarehgYkDgYYABACN2PIVpRTdfXLmNxkg8Bk2m5netqYsNW2Lefhklr2jfJiVUJUDPoZoGfabGzHEgsKjP2HRbPsEI_tND3x4N9VW0QAID2UYXa7GN0izHWIFRdjVYuR5-0jywFtd-o_N2POdrvlV8xumdVK-TiSPEIdfKoL_Iu0e7IKTsJsj-UmE8rDJnw",
  publicKey:
    "MIGbMBAGByqGSM49AgEGBSuBBAAjA4GGAAQAjdjyFaUU3X1y5jcZIPAZNpuZ3ramLDVti3n4ZJa9o3yYlVCVAz6GaBn2mxsxxILCoz9h0Wz7BCP7TQ98eDfVVtEACA9lGF2uxjdIsx1iBUXY1WLkeftI8sBbXfqPzdjzna75VfMbpnVSvk4kjxCHXyqC_yLtHuyCk7CbI_lJhPKwyZ8",
  type: "EC",
};

export const TEST_EC_KEY_JWK: KryptosJwk = {
  x: "APR_foe7ldh7LLa8ZFvQA6t2niQqzdFbV38w7jt5KrCcMGoIizvVqHEf4DeFe-KGI8u3QiP7UNVrU1yuldAoEwhw",
  y: "ABzy87I16-HAaIfLYfT1vayxG0HuHX8h771d9EnX_vweC1fcMHetmzYDKT5heXvVE4JmREBsoGwdk4e7vDSD5RVR",
  crv: "P-521",
  kty: "EC",
  d: "AcDSceRWjuYGq83oE_BgW_P7SRwYhUrLRAvhsjxCFe9iE3gyKBurav6YguL-OWJJ40dGQ7XJQW1D8S4or8QMuLIE",
};

export const TEST_EC_KEY_PEM: KryptosPem = {
  curve: "P-521",
  type: "EC",
  privateKey:
    "-----BEGIN PRIVATE KEY-----\n" +
    "MIHuAgEAMBAGByqGSM49AgEGBSuBBAAjBIHWMIHTAgEBBEIBwNJx5FaO5garzegT\n" +
    "8GBb8/tJHBiFSstEC+GyPEIV72ITeDIoG6tq/piC4v45YknjR0ZDtclBbUPxLiiv\n" +
    "xAy4sgShgYkDgYYABAD0f36Hu5XYeyy2vGRb0AOrdp4kKs3RW1d/MO47eSqwnDBq\n" +
    "CIs71ahxH+A3hXvihiPLt0Ij+1DVa1NcrpXQKBMIcAAc8vOyNevhwGiHy2H09b2s\n" +
    "sRtB7h1/Ie+9XfRJ1/78HgtX3DB3rZs2Ayk+YXl71ROCZkRAbKBsHZOHu7w0g+UV\n" +
    "UQ==\n" +
    "-----END PRIVATE KEY-----\n",
  publicKey:
    "-----BEGIN PUBLIC KEY-----\n" +
    "MIGbMBAGByqGSM49AgEGBSuBBAAjA4GGAAQA9H9+h7uV2HsstrxkW9ADq3aeJCrN\n" +
    "0VtXfzDuO3kqsJwwagiLO9WocR/gN4V74oYjy7dCI/tQ1WtTXK6V0CgTCHAAHPLz\n" +
    "sjXr4cBoh8th9PW9rLEbQe4dfyHvvV30Sdf+/B4LV9wwd62bNgMpPmF5e9UTgmZE\n" +
    "QGygbB2Th7u8NIPlFVE=\n" +
    "-----END PUBLIC KEY-----\n",
};

export const TEST_EC_KEY_RAW: KryptosRaw = {
  curve: "P-521",
  type: "EC",
  privateKey: Buffer.from(
    "00c89158dcb7ee8ba413ddaf69ab22cfc837cc0dd35d14236fbb76456390131bf5884044eb4a2582575b23a3e120534c654fc2dd6b9bdfba73e1fa5a896d16448323",
    "hex",
  ),
  publicKey: Buffer.from(
    "04007cd4063ff95e1f17bd821bddde896f055f518f7584fc9a2eaf4877421476b789273435bc30d7293b65dfecdf202bf4a48ac9c43194fa66903ad341fa51a60c8c4300f49820da39721f3acca92dafedf273d5545ded424c822f75394ba9979bf44f57a87f56a5aa6da830e760adb0044e99d71dd09a4d140bdeb5abfb4bc01387366337",
    "hex",
  ),
};
