import {
  IKryptosEc,
  IKryptosOct,
  IKryptosOkp,
  IKryptosRsa,
  Kryptos,
} from "@lindorm/kryptos";

export const TEST_EC_KEY = Kryptos.from("b64", {
  algorithm: "ECDH-ES",
  curve: "P-521",
  privateKey:
    "MIHuAgEAMBAGByqGSM49AgEGBSuBBAAjBIHWMIHTAgEBBEIATAYo3DQYroDV5EgJSUs_kOIvnEScZen73gXa5oQkub0ekQmgOJdPQjINUsdYRn67QK_oBdNUhVbtG_qdxqIgarehgYkDgYYABACN2PIVpRTdfXLmNxkg8Bk2m5netqYsNW2Lefhklr2jfJiVUJUDPoZoGfabGzHEgsKjP2HRbPsEI_tND3x4N9VW0QAID2UYXa7GN0izHWIFRdjVYuR5-0jywFtd-o_N2POdrvlV8xumdVK-TiSPEIdfKoL_Iu0e7IKTsJsj-UmE8rDJnw",
  publicKey:
    "MIGbMBAGByqGSM49AgEGBSuBBAAjA4GGAAQAjdjyFaUU3X1y5jcZIPAZNpuZ3ramLDVti3n4ZJa9o3yYlVCVAz6GaBn2mxsxxILCoz9h0Wz7BCP7TQ98eDfVVtEACA9lGF2uxjdIsx1iBUXY1WLkeftI8sBbXfqPzdjzna75VfMbpnVSvk4kjxCHXyqC_yLtHuyCk7CbI_lJhPKwyZ8",
  type: "EC",
  use: "enc",
}) as IKryptosEc;

export const TEST_OCT_KEY = Kryptos.from("b64", {
  algorithm: "dir",
  privateKey:
    "diYnyceZxmn18xGjVobBEwOSj2QOavHfv_tWGNuBpjND572Pa3qD8PDqDSrvoLtLOWyHdQ5lsmsuEIDcPgbPKp92HfNkawbKpCsVNBpoTlbZ-5jewLMREoGje9_pQzGSPLgh-cAkwtcrLUJNbwbyMGMlXmIJXeGukWsD6BfOAimNzPIyLf8QYMJYL9tzf16X4mQ1SvU76Y8Mqop6wz8ylAET7xWTivI-iOK8Zk1MiiomJww5w47Uz7X6Ha_uz7ctCESsyYMef9ZnYlsqwsHPrnP78ihyiv8cH7obubKJ6HkmsCnSTBOchDYxnmQiVZffuMSb8pScaIK6Vfef_1c7Vg",
  publicKey: "",
  type: "oct",
  use: "enc",
}) as IKryptosOct;

export const TEST_OKP_KEY = Kryptos.from("b64", {
  algorithm: "ECDH-ES",
  curve: "X25519",
  privateKey: "MC4CAQAwBQYDK2VuBCIEILg8BMTo-I04LCbAAECICMTwx4w6J0d1P9PhpNN8ocVz",
  publicKey: "MCowBQYDK2VuAyEAahY7DQXMXDRj-i9-ssIfCkaEYe_UYtRq9Z6HqJBKMWc",
  type: "OKP",
  use: "enc",
}) as IKryptosOkp;

export const TEST_RSA_KEY = Kryptos.from("b64", {
  algorithm: "RS512",
  privateKey:
    "MIIJKQIBAAKCAgEA7cxLHoxaHdYU8EX2ij5m42XIQYWBUxKMOfVbV2OX0nNHEdojXfRfONvrAHwsvRqcdN44yv1E1be18qs5HRB67D3qLeRjXcjegdjWvQj66IFVZIxQHNJ-LXDbAYs7gez8RYbBObnDzfrqy9vIPZet1tbqvlxv9aTR38x3ORJ4Y6Ym9StbKOUIo7BLIvoc1M5uNUIEnFKKZhbmVR423-F50w_E0618KExZgeur_8cMsSWZxyl0oeSI-rIodjfVJbshT1yy98zKRj-mMnyPKgHQARr9SwDA5Xlt9L2fVZ72xgwaPOBUgFoDTPQsqQ3Rkj7nYUSqwQVEL0-oH2K7U3OeGeKyIQMNzRdSfYMw3gSc5dtwqX64oK33lN2jzTKa0clSZjqJ4jzUL1YrXMddF07dMQqjN2mGjeZVy5LaO4B58Y5l-kO01KdwA-_LcDhkNgbKiZMZVtNPlVkR3nCvInt5cqPOqMOcLW3oA1wmh7zauWqorklpSSs75zw8ETtzATSJv8h7kUG9Bl1QQgdBkGqKb4ZG-r5Bj6pwJrHVmgPSMowP8P9G13iQLFdKX714A3DMKDc03TJvs2yVK81YUCtO5aRdwb0q0YcFqn9BHI3cmO-kOhXquMakPQ3zW_FBSnIeBhJMObCQOmYEuZxrifMcCQTY7j5jsP962e7ZPn53STcCAwEAAQKCAgArosNeFa8rrm8lMBFviMfkjnbS3ya-Ebc9o3JhdNsVOSYfdoHq6b7XdjOHYUHsaYewQl71kMgi15VBtH3EgZOs6iegyDobqZJ7DUlKYu134NPEoaLJxy50NDNb8yq2SsB4GaQ3bYkqsRKI2gnCk6TIuaNVzyyUTOxePuzZwjPpRUH81znhJTYSo3UGNBM6Ua8TgsvJy7OtzCH0GJlFN-DdBBXAKiOQWYJLPu3O_72qfBXd4BOQ6ZjhN_QIzXIFfHM-VupYYnHzthZPSWAT-0UqDsPQEZFUCpZMxMcKNSNfcDUYWqnm652Tb3MKioicZ4KZ7LnQtaCvddSJ_doWFC88gjf2CFVdB7XlL2qkK6jY7tQXAJ4NAZwZo7PtIHf3lTvD8jI6a1ANf_MEb2Ww-ZNJHVw8ht0SB-ucLJtllyNesTc9MwyLdwp8864KK2TBT3V2h0h9ksySTB6oqWYY4tghz4mZmH95GvttORqVeJXExNMhrouI7-nbTJa6QInFb7ZGeRg3aV0GcNTQfYmEpCuwPz5hFz_MGcslDZMyvDraE3C1XYMNWg0Pewm7RII4xR0fQqZ8iSkE8RnjeyYJQv17R8b-rTTgFt2a3yri9Xy2t1gX-fP776jK5qx7T1wnsJ_6qao1aqwBuLpk1HTi1YJBqvc57DXRnN9m2cPeM351gQKCAQEA-chzifBq71q8mETLfBQjWh5kKkVUdaaSuZ02lyMhziR8iZAsF0R08SFP2XWlOJrRGvLBItul787MurOI4VLhOSF-y5CZufSxHO-xDsZTDGD-GxYWAuLcdshcSl4HyJ4SZs13u3FUNVJeINC6IY4kn8iWHnPUbUHtu4kKvd-0t6hYxUB36wb_4fUjnQnghjtSJK23oeoArQ7ZDA0hApC3fPE2g5oQDkGqWDd1Smrmz3XlAZTMK9vqUlGHZRhaqC-dBhptLGSUulwrncEqsYKlW7NYppAWgHAY40wRy5Yglpv9GOhtJfUqkm7mQsmLhVw-1GtGc7Mi8sP3Nn-03mcqoQKCAQEA87d6H0DGvJNNLCZdlexp9Q84PpZYMMy-4JjbOpZh6qyhvclgXnkwXk0uo7G1dI5a--Eggft6_nQs8qQ-2bbtJ3V6BAECnEsWPJeWmeiMFEf0L51P0MMf_AY5Y4XOLCE6A3TieuH4NJ0iWMIZqYkCEYIqGTjR3TWNkSzQGJaewKpDu1m95dZCIbXGMXc0Tg6QJF0DIRdpqSQw5QAyLFmSQYLudjds688te-s63g02W_xLeUgKOKd-zsMY_xnubElXaEXVItBtgpbPoMqz6DGr92uNTpKUO3Wb2swIHhoMKp5G7XNQzSlsHLnEjwbz8m4xMXlCZDfx_-ukJ0iNFlz81wKCAQEAqxYylUO4axPSY9WTLvy4Lizs3Ms6C4-5pitZzfHBYOo65xp6KMG5-8OeZsufDIN2QKgPw-mA4h3auvLoCbX0EGax64qy0N0aR0CiHQWYsrzor_LTxsxOx4l7NXDskew7nHCV1yzLye4ODRoKs5sh2NPShy89TEzBIhe-5MkKhlVn4EvFF5VmxQVcjF7MjASrwfW-9sdKCT9HSWrgtlobZBfwB_oJj0pI_D2YOA265FTTM98QbeYmvJWdUJB64AIk4p5NMv_9oxwov9gkfwuGaaYRTZ0Z3IVrdpyO_8xnq-FSXbItuLcRntUZIJvd1c2WN3b2_Z6wjGnPtWOJpmAxoQKCAQAdD-kBJxFL1WjjdeO9CAcOkPUNCZKUpyWv1Kp3zwz4FgPnhMb4HQ12gU-pd3yC3KLe3FarCVj-VM4zVQClp5maFfkp1xD_oDiTmyP7UG670GS-9MxawZnjzL41LvSJ8KBhXyPOsXmOlJpO6T50KAFWIyZwAYWNEmDCSgy6keN2aBdRlP7_FFCogmuS5HsZP8VSgMDpxkf0QnuOIzrYbQnyw_E5qZxUdk0fNMq9RegQigJaAQwu-1I0x7EIYog643gH2CP1VdNpOiCiNOnFK38tLucX0oTYnkqqiaACLur6fgtJL3IYNPNObZyRzatzYk59bs9K8hzqfqgBgzZHz2jbAoIBAQCmSl--lhVQbwXWjJMoXQYwZB7iLVXAgZDgzjStZlQ_nEmYf6v-QTPsPz6UKc5FWylCfWA-5B6_rdRFoX_bkHOYGS5G0peubDhsW8rKwuqCbY9Yfy8EM44D559NRW29J0eVDVpRhEtY3j_YqFZD9n5fS-VhMbKO1hZCMQK_kI4CuJ1q8TaIx-L69Yl7UtYHnmtyatuHaNzfx6cw10PZIn0YxB5OFl5bmKYKVqHw0JD_CozWoKAhUfbYS55K3DGfh2jJtGpdyOq8VS-e8H14C_GZxdwN1Umi7dzvOcHd-_xi_3DcHEwNLtkDhkCeWlE3PQs0Cu5yWl3NlaFVrRmN9csJ",
  publicKey:
    "MIICCgKCAgEA7cxLHoxaHdYU8EX2ij5m42XIQYWBUxKMOfVbV2OX0nNHEdojXfRfONvrAHwsvRqcdN44yv1E1be18qs5HRB67D3qLeRjXcjegdjWvQj66IFVZIxQHNJ-LXDbAYs7gez8RYbBObnDzfrqy9vIPZet1tbqvlxv9aTR38x3ORJ4Y6Ym9StbKOUIo7BLIvoc1M5uNUIEnFKKZhbmVR423-F50w_E0618KExZgeur_8cMsSWZxyl0oeSI-rIodjfVJbshT1yy98zKRj-mMnyPKgHQARr9SwDA5Xlt9L2fVZ72xgwaPOBUgFoDTPQsqQ3Rkj7nYUSqwQVEL0-oH2K7U3OeGeKyIQMNzRdSfYMw3gSc5dtwqX64oK33lN2jzTKa0clSZjqJ4jzUL1YrXMddF07dMQqjN2mGjeZVy5LaO4B58Y5l-kO01KdwA-_LcDhkNgbKiZMZVtNPlVkR3nCvInt5cqPOqMOcLW3oA1wmh7zauWqorklpSSs75zw8ETtzATSJv8h7kUG9Bl1QQgdBkGqKb4ZG-r5Bj6pwJrHVmgPSMowP8P9G13iQLFdKX714A3DMKDc03TJvs2yVK81YUCtO5aRdwb0q0YcFqn9BHI3cmO-kOhXquMakPQ3zW_FBSnIeBhJMObCQOmYEuZxrifMcCQTY7j5jsP962e7ZPn53STcCAwEAAQ",
  type: "RSA",
  use: "sig",
}) as IKryptosRsa;
