import { Kryptos } from "@lindorm/kryptos";

export const TEST_EC_KEY = Kryptos.from("b64", {
  curve: "P-521",
  privateKey:
    "MIHuAgEAMBAGByqGSM49AgEGBSuBBAAjBIHWMIHTAgEBBEIATAYo3DQYroDV5EgJSUs_kOIvnEScZen73gXa5oQkub0ekQmgOJdPQjINUsdYRn67QK_oBdNUhVbtG_qdxqIgarehgYkDgYYABACN2PIVpRTdfXLmNxkg8Bk2m5netqYsNW2Lefhklr2jfJiVUJUDPoZoGfabGzHEgsKjP2HRbPsEI_tND3x4N9VW0QAID2UYXa7GN0izHWIFRdjVYuR5-0jywFtd-o_N2POdrvlV8xumdVK-TiSPEIdfKoL_Iu0e7IKTsJsj-UmE8rDJnw",
  publicKey:
    "MIGbMBAGByqGSM49AgEGBSuBBAAjA4GGAAQAjdjyFaUU3X1y5jcZIPAZNpuZ3ramLDVti3n4ZJa9o3yYlVCVAz6GaBn2mxsxxILCoz9h0Wz7BCP7TQ98eDfVVtEACA9lGF2uxjdIsx1iBUXY1WLkeftI8sBbXfqPzdjzna75VfMbpnVSvk4kjxCHXyqC_yLtHuyCk7CbI_lJhPKwyZ8",
  type: "EC",
});

export const TEST_OCT_KEY = Kryptos.from("b64", {
  privateKey: "NjVhNF9EK0BTUWJAd0AwUU9IQWkmdTgwWEo2QDJmYjI",
  type: "oct",
});

export const TEST_OKP_KEY = Kryptos.from("b64", {
  curve: "Ed25519",
  privateKey: "MC4CAQAwBQYDK2VwBCIEIBwKJlvoh1ngd9LRd7dtvGOSqW4uZamdvIu0ABD2AkxL",
  publicKey: "MCowBQYDK2VwAyEAGRCwCA6lChosFGMQwxGiHCdzblfvCz0FNiRtTnm1qqc",
  type: "OKP",
});

export const TEST_RSA_KEY = Kryptos.from("b64", {
  privateKey:
    "MIICXgIBAAKBgQDOc2YcdNY6XGu1NDK3bF4rFt_yAk1ccopldxqd9WT9Akd7sTh4LqMLwxMDLgHJjs5BqVD9Ay4YYU6c_CXi4puvEY1oBi0jrbgo-ORq87qt695mqaljDPKL6mNapUqSG59Ok8WR8-RkRV6uf3uQnWjUOtqPbNBF9KMFQqbUFp449QIDAQABAoGBAKrGgr0fWObF9MLb_ugD2JHERlOm29-RUDJGp9nqWDOCYydKne-shGsCXwPOVuQoIS3npXrl2oeIVsM9QQnBcg2O8EGFtdmvmO5gghhGFOj4oSXbuFasXqeGUOagRKLBznizUFpBsEwjgDkgXVudbwZSPi1u-NThCNGCQWjyBOkxAkEA7OPAlFXaX4iDoDvynfKdzDLnVTewxxu291BGZ_EjqjJ-zIjPbXBh0ghqV4EOHXVj6Uo1Qfg3QIth0bDV9z23kwJBAN8bBcQfoiH0fuaa8SWlsJiCr5FZo75081ZGystgtU1l9ki76XIFtY4enem6a448v1MSl5HG-49wpj29VHwhklcCQQDc2RxSbpPvGst0GE-Bl44rsI1hMlFZ32m9uhZZk0OnyfnS3_1aTzqzYGsb91JcfnPOLAPo4-tG_msM3mssXFqHAkBuPK3msDKuUF57l0db8LiHQtt5GC-eJa8ujCAbyZcLvTupyJ-aZVPF-z7Pg_ss9rsaUu9takJWJ7UcgHZEN1pVAkEAy9YBQKl2SMC9jlSOQzrenBaYvVrnCJ8heGB_RzOTZ_pJc30Ak41g8YK39F0cLUqWes5ASS3eYWVmw_sAd36wyA",
  publicKey:
    "MIGJAoGBAM5zZhx01jpca7U0MrdsXisW3_ICTVxyimV3Gp31ZP0CR3uxOHguowvDEwMuAcmOzkGpUP0DLhhhTpz8JeLim68RjWgGLSOtuCj45Grzuq3r3mapqWMM8ovqY1qlSpIbn06TxZHz5GRFXq5_e5CdaNQ62o9s0EX0owVCptQWnjj1AgMBAAE",
  type: "RSA",
});
