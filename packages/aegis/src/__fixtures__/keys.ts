import { Kryptos, KryptosFromB64 } from "@lindorm/kryptos";

const defaults = {
  notBefore: new Date("2023-01-01T01:00:00.000Z"),
  updatedAt: new Date("2024-01-01T07:59:00.000Z"),
  expiresAt: new Date("2024-06-01T00:00:00.000Z"),
  issuer: "https://test.lindorm.io/",
  jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
};

const EC: KryptosFromB64 = {
  ...defaults,
  algorithm: "ES512",
  curve: "P-521",
  privateKey:
    "MIHuAgEAMBAGByqGSM49AgEGBSuBBAAjBIHWMIHTAgEBBEIATAYo3DQYroDV5EgJSUs_kOIvnEScZen73gXa5oQkub0ekQmgOJdPQjINUsdYRn67QK_oBdNUhVbtG_qdxqIgarehgYkDgYYABACN2PIVpRTdfXLmNxkg8Bk2m5netqYsNW2Lefhklr2jfJiVUJUDPoZoGfabGzHEgsKjP2HRbPsEI_tND3x4N9VW0QAID2UYXa7GN0izHWIFRdjVYuR5-0jywFtd-o_N2POdrvlV8xumdVK-TiSPEIdfKoL_Iu0e7IKTsJsj-UmE8rDJnw",
  publicKey:
    "MIGbMBAGByqGSM49AgEGBSuBBAAjA4GGAAQAjdjyFaUU3X1y5jcZIPAZNpuZ3ramLDVti3n4ZJa9o3yYlVCVAz6GaBn2mxsxxILCoz9h0Wz7BCP7TQ98eDfVVtEACA9lGF2uxjdIsx1iBUXY1WLkeftI8sBbXfqPzdjzna75VfMbpnVSvk4kjxCHXyqC_yLtHuyCk7CbI_lJhPKwyZ8",
  type: "EC",
  use: "sig",
};

export const TEST_EC_KEY_SIG = Kryptos.from("b64", {
  ...EC,
  id: "b9e7bb4d-d332-55d2-9b33-f990ff7db4c7",
  algorithm: "ES512",
  createdAt: new Date("2024-01-01T00:01:00.000Z"),
  operations: ["sign", "verify"],
  use: "sig",
});

export const TEST_EC_KEY_ENC = Kryptos.from("b64", {
  ...EC,
  id: "43bd1720-5dab-5d52-ae1e-e9dbbe6adfe4",
  algorithm: "ECDH-ES",
  createdAt: new Date("2024-01-01T00:02:00.000Z"),
  operations: ["encrypt", "decrypt"],
  use: "enc",
});

export const TEST_OCT_KEY_SIG = Kryptos.from("b64", {
  ...defaults,
  id: "d32bed7b-40d7-5851-aad6-95589dadb65e",
  algorithm: "HS256",
  privateKey:
    "jkjatRYjOjLiTeeCTl3Vsd3mBusYraGbn1UL6ZWvKBuoBXRFKL2EP9S3GuvdxUVif8C1lsQtbcY0y9tZP9tHvg",
  publicKey: "",
  type: "oct",
  use: "sig",
  createdAt: new Date("2024-01-01T00:03:00.000Z"),
  operations: ["sign", "verify"],
});

export const TEST_OCT_KEY_ENC = Kryptos.from("b64", {
  ...defaults,
  id: "ae26175f-961d-5947-8318-6299e4576b83",
  algorithm: "dir",
  createdAt: new Date("2024-01-01T00:04:00.000Z"),
  operations: ["encrypt", "decrypt", "deriveKey"],
  privateKey: "0SAdXqYgUS_IPXzub2spRQ2VLJl95iTn3wl4HIRYRZg",
  publicKey: "",
  type: "oct",
  use: "enc",
});

export const TEST_OKP_KEY_SIG = Kryptos.from("b64", {
  ...defaults,
  id: "2fa52a91-7f63-5731-a55d-30d36350c642",
  algorithm: "EdDSA",
  createdAt: new Date("2024-01-01T00:05:00.000Z"),
  curve: "Ed25519",
  operations: ["sign", "verify"],
  privateKey: "MC4CAQAwBQYDK2VwBCIEIBwKJlvoh1ngd9LRd7dtvGOSqW4uZamdvIu0ABD2AkxL",
  publicKey: "MCowBQYDK2VwAyEAGRCwCA6lChosFGMQwxGiHCdzblfvCz0FNiRtTnm1qqc",
  type: "OKP",
  use: "sig",
});

export const TEST_OKP_KEY_ENC = Kryptos.from("b64", {
  ...defaults,
  id: "035f7f00-8101-5387-a935-e92f57347309",
  algorithm: "ECDH-ES",
  createdAt: new Date("2024-01-01T00:05:00.000Z"),
  curve: "X25519",
  operations: ["encrypt", "decrypt"],
  privateKey: "MC4CAQAwBQYDK2VuBCIEIBB4SslTDV2-GpNJHFXK5ES2j1j7Pa0JNPSzSFxp8Pxb",
  publicKey: "MCowBQYDK2VuAyEA_n8Jf_SY9qIWg51xoHfLiOaW2O42n-k25BQ4apw3QGU",
  type: "OKP",
  use: "enc",
});

const RSA: KryptosFromB64 = {
  ...defaults,
  algorithm: "RS512",
  privateKey:
    "MIIJKQIBAAKCAgEA7cxLHoxaHdYU8EX2ij5m42XIQYWBUxKMOfVbV2OX0nNHEdojXfRfONvrAHwsvRqcdN44yv1E1be18qs5HRB67D3qLeRjXcjegdjWvQj66IFVZIxQHNJ-LXDbAYs7gez8RYbBObnDzfrqy9vIPZet1tbqvlxv9aTR38x3ORJ4Y6Ym9StbKOUIo7BLIvoc1M5uNUIEnFKKZhbmVR423-F50w_E0618KExZgeur_8cMsSWZxyl0oeSI-rIodjfVJbshT1yy98zKRj-mMnyPKgHQARr9SwDA5Xlt9L2fVZ72xgwaPOBUgFoDTPQsqQ3Rkj7nYUSqwQVEL0-oH2K7U3OeGeKyIQMNzRdSfYMw3gSc5dtwqX64oK33lN2jzTKa0clSZjqJ4jzUL1YrXMddF07dMQqjN2mGjeZVy5LaO4B58Y5l-kO01KdwA-_LcDhkNgbKiZMZVtNPlVkR3nCvInt5cqPOqMOcLW3oA1wmh7zauWqorklpSSs75zw8ETtzATSJv8h7kUG9Bl1QQgdBkGqKb4ZG-r5Bj6pwJrHVmgPSMowP8P9G13iQLFdKX714A3DMKDc03TJvs2yVK81YUCtO5aRdwb0q0YcFqn9BHI3cmO-kOhXquMakPQ3zW_FBSnIeBhJMObCQOmYEuZxrifMcCQTY7j5jsP962e7ZPn53STcCAwEAAQKCAgArosNeFa8rrm8lMBFviMfkjnbS3ya-Ebc9o3JhdNsVOSYfdoHq6b7XdjOHYUHsaYewQl71kMgi15VBtH3EgZOs6iegyDobqZJ7DUlKYu134NPEoaLJxy50NDNb8yq2SsB4GaQ3bYkqsRKI2gnCk6TIuaNVzyyUTOxePuzZwjPpRUH81znhJTYSo3UGNBM6Ua8TgsvJy7OtzCH0GJlFN-DdBBXAKiOQWYJLPu3O_72qfBXd4BOQ6ZjhN_QIzXIFfHM-VupYYnHzthZPSWAT-0UqDsPQEZFUCpZMxMcKNSNfcDUYWqnm652Tb3MKioicZ4KZ7LnQtaCvddSJ_doWFC88gjf2CFVdB7XlL2qkK6jY7tQXAJ4NAZwZo7PtIHf3lTvD8jI6a1ANf_MEb2Ww-ZNJHVw8ht0SB-ucLJtllyNesTc9MwyLdwp8864KK2TBT3V2h0h9ksySTB6oqWYY4tghz4mZmH95GvttORqVeJXExNMhrouI7-nbTJa6QInFb7ZGeRg3aV0GcNTQfYmEpCuwPz5hFz_MGcslDZMyvDraE3C1XYMNWg0Pewm7RII4xR0fQqZ8iSkE8RnjeyYJQv17R8b-rTTgFt2a3yri9Xy2t1gX-fP776jK5qx7T1wnsJ_6qao1aqwBuLpk1HTi1YJBqvc57DXRnN9m2cPeM351gQKCAQEA-chzifBq71q8mETLfBQjWh5kKkVUdaaSuZ02lyMhziR8iZAsF0R08SFP2XWlOJrRGvLBItul787MurOI4VLhOSF-y5CZufSxHO-xDsZTDGD-GxYWAuLcdshcSl4HyJ4SZs13u3FUNVJeINC6IY4kn8iWHnPUbUHtu4kKvd-0t6hYxUB36wb_4fUjnQnghjtSJK23oeoArQ7ZDA0hApC3fPE2g5oQDkGqWDd1Smrmz3XlAZTMK9vqUlGHZRhaqC-dBhptLGSUulwrncEqsYKlW7NYppAWgHAY40wRy5Yglpv9GOhtJfUqkm7mQsmLhVw-1GtGc7Mi8sP3Nn-03mcqoQKCAQEA87d6H0DGvJNNLCZdlexp9Q84PpZYMMy-4JjbOpZh6qyhvclgXnkwXk0uo7G1dI5a--Eggft6_nQs8qQ-2bbtJ3V6BAECnEsWPJeWmeiMFEf0L51P0MMf_AY5Y4XOLCE6A3TieuH4NJ0iWMIZqYkCEYIqGTjR3TWNkSzQGJaewKpDu1m95dZCIbXGMXc0Tg6QJF0DIRdpqSQw5QAyLFmSQYLudjds688te-s63g02W_xLeUgKOKd-zsMY_xnubElXaEXVItBtgpbPoMqz6DGr92uNTpKUO3Wb2swIHhoMKp5G7XNQzSlsHLnEjwbz8m4xMXlCZDfx_-ukJ0iNFlz81wKCAQEAqxYylUO4axPSY9WTLvy4Lizs3Ms6C4-5pitZzfHBYOo65xp6KMG5-8OeZsufDIN2QKgPw-mA4h3auvLoCbX0EGax64qy0N0aR0CiHQWYsrzor_LTxsxOx4l7NXDskew7nHCV1yzLye4ODRoKs5sh2NPShy89TEzBIhe-5MkKhlVn4EvFF5VmxQVcjF7MjASrwfW-9sdKCT9HSWrgtlobZBfwB_oJj0pI_D2YOA265FTTM98QbeYmvJWdUJB64AIk4p5NMv_9oxwov9gkfwuGaaYRTZ0Z3IVrdpyO_8xnq-FSXbItuLcRntUZIJvd1c2WN3b2_Z6wjGnPtWOJpmAxoQKCAQAdD-kBJxFL1WjjdeO9CAcOkPUNCZKUpyWv1Kp3zwz4FgPnhMb4HQ12gU-pd3yC3KLe3FarCVj-VM4zVQClp5maFfkp1xD_oDiTmyP7UG670GS-9MxawZnjzL41LvSJ8KBhXyPOsXmOlJpO6T50KAFWIyZwAYWNEmDCSgy6keN2aBdRlP7_FFCogmuS5HsZP8VSgMDpxkf0QnuOIzrYbQnyw_E5qZxUdk0fNMq9RegQigJaAQwu-1I0x7EIYog643gH2CP1VdNpOiCiNOnFK38tLucX0oTYnkqqiaACLur6fgtJL3IYNPNObZyRzatzYk59bs9K8hzqfqgBgzZHz2jbAoIBAQCmSl--lhVQbwXWjJMoXQYwZB7iLVXAgZDgzjStZlQ_nEmYf6v-QTPsPz6UKc5FWylCfWA-5B6_rdRFoX_bkHOYGS5G0peubDhsW8rKwuqCbY9Yfy8EM44D559NRW29J0eVDVpRhEtY3j_YqFZD9n5fS-VhMbKO1hZCMQK_kI4CuJ1q8TaIx-L69Yl7UtYHnmtyatuHaNzfx6cw10PZIn0YxB5OFl5bmKYKVqHw0JD_CozWoKAhUfbYS55K3DGfh2jJtGpdyOq8VS-e8H14C_GZxdwN1Umi7dzvOcHd-_xi_3DcHEwNLtkDhkCeWlE3PQs0Cu5yWl3NlaFVrRmN9csJ",
  publicKey:
    "MIICCgKCAgEA7cxLHoxaHdYU8EX2ij5m42XIQYWBUxKMOfVbV2OX0nNHEdojXfRfONvrAHwsvRqcdN44yv1E1be18qs5HRB67D3qLeRjXcjegdjWvQj66IFVZIxQHNJ-LXDbAYs7gez8RYbBObnDzfrqy9vIPZet1tbqvlxv9aTR38x3ORJ4Y6Ym9StbKOUIo7BLIvoc1M5uNUIEnFKKZhbmVR423-F50w_E0618KExZgeur_8cMsSWZxyl0oeSI-rIodjfVJbshT1yy98zKRj-mMnyPKgHQARr9SwDA5Xlt9L2fVZ72xgwaPOBUgFoDTPQsqQ3Rkj7nYUSqwQVEL0-oH2K7U3OeGeKyIQMNzRdSfYMw3gSc5dtwqX64oK33lN2jzTKa0clSZjqJ4jzUL1YrXMddF07dMQqjN2mGjeZVy5LaO4B58Y5l-kO01KdwA-_LcDhkNgbKiZMZVtNPlVkR3nCvInt5cqPOqMOcLW3oA1wmh7zauWqorklpSSs75zw8ETtzATSJv8h7kUG9Bl1QQgdBkGqKb4ZG-r5Bj6pwJrHVmgPSMowP8P9G13iQLFdKX714A3DMKDc03TJvs2yVK81YUCtO5aRdwb0q0YcFqn9BHI3cmO-kOhXquMakPQ3zW_FBSnIeBhJMObCQOmYEuZxrifMcCQTY7j5jsP962e7ZPn53STcCAwEAAQ",
  type: "RSA",
  use: "sig",
};

export const TEST_RSA_KEY_SIG = Kryptos.from("b64", {
  ...RSA,
  id: "aaac22b3-2253-5598-8e0c-1733fc748122",
  algorithm: "RS512",
  createdAt: new Date("2024-01-01T00:06:00.000Z"),
  operations: ["sign", "verify"],
  use: "sig",
});
export const TEST_RSA_KEY_ENC = Kryptos.from("b64", {
  ...RSA,
  id: "20b09138-bab7-54ce-a491-1f4ba52e3d4e",
  algorithm: "RSA-OAEP-256",
  createdAt: new Date("2024-01-01T00:07:00.000Z"),
  operations: ["encrypt", "decrypt"],
  use: "enc",
});
