import { Kryptos } from "@lindorm/kryptos";

export const EC_KEY_SET = Kryptos.from("pem", {
  id: "b1ca2923-7a82-5f21-8d23-8d76cf4e2abf",
  curve: "P-521",
  privateKey:
    "-----BEGIN PRIVATE KEY-----\n" +
    "MIHuAgEAMBAGByqGSM49AgEGBSuBBAAjBIHWMIHTAgEBBEIB+1dzKp5FO/wISTaI\n" +
    "PHCv1yZLMZl0o6BAXgMKibC6e8iFI9W4YIrZYTInHDpqA/wNd764XikWWse9jRRw\n" +
    "KLYy02KhgYkDgYYABAFyw1SdEKD9Sz2XojfjqCPVoilq5YSZjLBmZtXG2x6ydRUW\n" +
    "3Q/IL7kfEtKycJ42z9UhP4adevymNBQ4J02/Yx/jswGcKMep28r825kUE64LbsUc\n" +
    "8b4/pgKHEX2bR9n1Vw5uJRWEtPKVBXeV9dk0D1I/1/iDYJRkc3OwZ1+MYWN31i5r\n" +
    "tg==\n" +
    "-----END PRIVATE KEY-----\n",
  publicKey:
    "-----BEGIN PUBLIC KEY-----\n" +
    "MIGbMBAGByqGSM49AgEGBSuBBAAjA4GGAAQBcsNUnRCg/Us9l6I346gj1aIpauWE\n" +
    "mYywZmbVxtsesnUVFt0PyC+5HxLSsnCeNs/VIT+GnXr8pjQUOCdNv2Mf47MBnCjH\n" +
    "qdvK/NuZFBOuC27FHPG+P6YChxF9m0fZ9VcObiUVhLTylQV3lfXZNA9SP9f4g2CU\n" +
    "ZHNzsGdfjGFjd9Yua7Y=\n" +
    "-----END PUBLIC KEY-----\n",
  type: "EC",
});
