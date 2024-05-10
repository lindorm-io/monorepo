import { KryptosB64, KryptosJwk, KryptosPem } from "../types";

export const TEST_RSA_KEY_B64: KryptosB64 = {
  privateKey:
    "MIICXgIBAAKBgQDOc2YcdNY6XGu1NDK3bF4rFt_yAk1ccopldxqd9WT9Akd7sTh4LqMLwxMDLgHJjs5BqVD9Ay4YYU6c_CXi4puvEY1oBi0jrbgo-ORq87qt695mqaljDPKL6mNapUqSG59Ok8WR8-RkRV6uf3uQnWjUOtqPbNBF9KMFQqbUFp449QIDAQABAoGBAKrGgr0fWObF9MLb_ugD2JHERlOm29-RUDJGp9nqWDOCYydKne-shGsCXwPOVuQoIS3npXrl2oeIVsM9QQnBcg2O8EGFtdmvmO5gghhGFOj4oSXbuFasXqeGUOagRKLBznizUFpBsEwjgDkgXVudbwZSPi1u-NThCNGCQWjyBOkxAkEA7OPAlFXaX4iDoDvynfKdzDLnVTewxxu291BGZ_EjqjJ-zIjPbXBh0ghqV4EOHXVj6Uo1Qfg3QIth0bDV9z23kwJBAN8bBcQfoiH0fuaa8SWlsJiCr5FZo75081ZGystgtU1l9ki76XIFtY4enem6a448v1MSl5HG-49wpj29VHwhklcCQQDc2RxSbpPvGst0GE-Bl44rsI1hMlFZ32m9uhZZk0OnyfnS3_1aTzqzYGsb91JcfnPOLAPo4-tG_msM3mssXFqHAkBuPK3msDKuUF57l0db8LiHQtt5GC-eJa8ujCAbyZcLvTupyJ-aZVPF-z7Pg_ss9rsaUu9takJWJ7UcgHZEN1pVAkEAy9YBQKl2SMC9jlSOQzrenBaYvVrnCJ8heGB_RzOTZ_pJc30Ak41g8YK39F0cLUqWes5ASS3eYWVmw_sAd36wyA",
  publicKey:
    "MIGJAoGBAM5zZhx01jpca7U0MrdsXisW3_ICTVxyimV3Gp31ZP0CR3uxOHguowvDEwMuAcmOzkGpUP0DLhhhTpz8JeLim68RjWgGLSOtuCj45Grzuq3r3mapqWMM8ovqY1qlSpIbn06TxZHz5GRFXq5_e5CdaNQ62o9s0EX0owVCptQWnjj1AgMBAAE",
  type: "RSA",
};

export const TEST_RSA_KEY_JWK: KryptosJwk = {
  e: "AQAB",
  n: "tsSkRYzjC1YlpxyrPw2oC-BligZg5-CrdIZ0bcvXCjvQNynYLHMS1IbCT53WMNFpeIlo1RLj84MsRM4BS6Ov3rPys042Ie-y23yMPH5ikXFHvmLjECvcsngHAHwroJ9JXyl3u8Qir3vnx_n_l1ggf3BgpG3utU0lMsw-eRq1aF8",
  kty: "RSA",
  d: "IrZAONFkQb_v0MhaIdSXKQJKZqeFeiSqi6wJqty_D7uCdSemXfLRDbo2Z2ajyovLS1BVr7oxvwsXuk2h41rISOJmtdJ2mCOwjbMhMXQ2-eknf1byOvxDrO9fBi-laL7IjZVWwe0hYjx8Plm33D9kdP29nhBvSMCkMQM4wtCBYek",
  p: "6Ex5gfLWiKK3P9illzQGbGju0Gc7UggVahZG6N9dy8GBk-hJ1S8qKSDxxn_T4wpUO6XAuPGrNhri8_zfAbpL3Q",
  q: "yWpz8BUWlIXcN5-l2NZuOOWhBP19D1UyEBnJQR6iisdER0uMGOGj7hcibIxUrV1SyzUvo9lKLc8wNDJCEIDPaw",
  dp: "gTSoEONk-DKpAlYaJHPHbt0el8QTdpkQcCVb44L5xK8ox3_YMT8-kAnG8MWAsTO5jkOvYi7pL_rcaSEpWOip8Q",
  dq: "M7CpLl0LHXS5DmFfW6W0Rc_Qogo39R5lKbKkbpzhFAKNqEpgGuaVfn3bbMYa2R8RJ2tv3XnfSqBYe5zGTZvxHw",
  qi: "dLC6kbyxCC4Mn3qb6CnHjJwJYVmFw2OsMmXCx8U3jXNNz0iQ_t_ByQ-IYEvY1SQgr7POS5AA3qcejoa1gvq1hw",
};

export const TEST_RSA_KEY_PEM: KryptosPem = {
  type: "RSA",
  privateKey:
    "-----BEGIN RSA PRIVATE KEY-----\n" +
    "MIICWwIBAAKBgQC9jx+pBrwmGMldRmNHGpNFTruWnv3HdGZdkFL2i/nJI04vEFS+\n" +
    "BslhrHqqePQBbkLeHOKu9l41U+9Cz9gTK1T5Moig+ZRvnfF0AkKjMHQcCqf2BgQQ\n" +
    "L/ygChP1omYpQx9W7W1Q6+RkNT7Sbspl5YNTJOAL81cZ/K1RTWTEGyR9UwIDAQAB\n" +
    "AoGASsV47JhugOyICVXpdTOjYdRTpG8klZdxhXiXcQ73wYI+pcvgUXCl4PRDEplR\n" +
    "TnsqvyhPtkoSESEBoK4RgkY2ZsMl8Bu6ZH//f62a4Y1PxxQpm7s13P9+fX3WvxZT\n" +
    "3SHnAN1izKBG+8FLISJ3FYbz9yVXMf3BSdwr1tHDlgYadwECQQDxdn+JFx3ej9EK\n" +
    "JnDki7FaAWuhBbDStWOe8zswgJ8khzZtTmNwdyZeaRdfv80rVUj8BkPKz2Mw6p6D\n" +
    "inxKC9HTAkEAyPiq70V+kHOYAXFrWGHcs+llazoBeKy9rYZDdfUSmACk/1tOOQ0p\n" +
    "ywCG3VOe5Xr5cMCYclVuT+DQLypO2dX2gQI/dAN7Q2LX9xciWL4ff6+ehqAoFjWl\n" +
    "v5dnRfeXeLZTwDk27U28eUzGIpZbpKWC7k8LwgtAhzEdd2NCxfDDxs/nAkAreJ6A\n" +
    "4yddV6OprD7r/z8eK34kk4d98t+UiVZOTZSYDIukMLva214O6y5A8bWNLeyG1yIi\n" +
    "mRgjbx2ZFi24MPABAkEA0wtgayXucRq/fp4yZ5ZGDsQVGTqUyrzacuww/wTO7YZs\n" +
    "3Ctg0SHS7VjZon/bLyLtW0mfpYwE6sq+tG3k5FyueQ==\n" +
    "-----END RSA PRIVATE KEY-----\n",
  publicKey:
    "-----BEGIN RSA PUBLIC KEY-----\n" +
    "MIGJAoGBAL2PH6kGvCYYyV1GY0cak0VOu5ae/cd0Zl2QUvaL+ckjTi8QVL4GyWGs\n" +
    "eqp49AFuQt4c4q72XjVT70LP2BMrVPkyiKD5lG+d8XQCQqMwdBwKp/YGBBAv/KAK\n" +
    "E/WiZilDH1btbVDr5GQ1PtJuymXlg1Mk4AvzVxn8rVFNZMQbJH1TAgMBAAE=\n" +
    "-----END RSA PUBLIC KEY-----\n",
};
