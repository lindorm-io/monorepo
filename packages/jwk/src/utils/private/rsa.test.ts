import { createSign, createVerify } from "crypto";
import { createRsaJwk, createRsaPem } from "./rsa";

const sign = (privateKey: string, input: string) => {
  const createdSign = createSign("sha512");
  createdSign.write(input);
  createdSign.end();
  return createdSign.sign({ key: privateKey, passphrase: "" }, "base64");
};

const verify = (publicKey: string, input: string, signature: string) => {
  const createdVerify = createVerify("sha512");
  createdVerify.write(input);
  createdVerify.end();
  return createdVerify.verify({ key: publicKey }, signature, "base64");
};

describe("rsa", () => {
  const id = "id";
  const kid = id;

  const type = "RSA";
  const kty = type;

  const privateKey =
    "-----BEGIN ENCRYPTED PRIVATE KEY-----\n" +
    "MIIC3TBXBgkqhkiG9w0BBQ0wSjApBgkqhkiG9w0BBQwwHAQI73j2DruGoZgCAggA\n" +
    "MAwGCCqGSIb3DQIJBQAwHQYJYIZIAWUDBAEqBBA1zkvIdjMOkQqPC0VrDGruBIIC\n" +
    "gO+CBYavUokPVzUUWNhh/nZ/14bK5E0HOrYkawvotp0ERSTqM45bR8CaJZE9cogK\n" +
    "zS83KPYJq6Eudu7RRHEOptfmJV9XkWvykGDVyoV7XLHqRV0yaqKntIOi7ar1c/Jy\n" +
    "kamJ0dw1m8yhvp6u25WLAtPTkm9hJ3vneU2X+Hk9cbGtCuXzuaf7VOPmUx6Tr6TV\n" +
    "aQo5ZtcDBaatamI3Bq0PlCr75mR7eAjVaEN01PMaJNWYIS+Bqd64cU3cqZWl97/q\n" +
    "UVom7kMFnNwM+IJ1eCBPbMCvqhwccADcVEdSMAWLtS6OzMOC8UO+hhs+zirbnw2n\n" +
    "3iCqSbuu0Aekh8qQRRe7DV6myvkJtQJydN2qkKQHhOK+vONwIKgf8H4Xoyefo43D\n" +
    "RwExh4VwzVT1iDDHIsjIgEfOEwM6SKSpekfe1jzL4nEwQZyQjIHHpdDse5hrPw1G\n" +
    "CPZ8H9id679igFaPPtHyf85PH2oRjkVfJuUX5nFxrlkRF/U5pxC+7D/AbdEdAJFQ\n" +
    "es0JWzNfR54z5Pg6baojk4u7UggQMOSGNkTfZx5f9nWeTeiPp9fAnf/lE5FTjqWr\n" +
    "jSRuyplFwVBPcvy497gRlGJQh4SPwqFsurjV3yXl3mFbHCtrm967uR58yVuaF658\n" +
    "E0Dobem0s0Qexghaz/wuNRplaGUh+0kC5a8pJsB4vYVhq+goEhawisBriCt3JNeX\n" +
    "YZe1vw1+Ze/LCfxf6N8N+/d0OoYXavZGDiO3hebuJXgHtrM7zNZNLwq4RCvgGcBd\n" +
    "OwB9V2N3H2119vsfdASo399qL163UKUqNN3eWld9uL5h/HHLRYMTOloAOP9wJi31\n" +
    "8VnSW4qtRe+cZMZ0yuEVxmc=\n" +
    "-----END ENCRYPTED PRIVATE KEY-----\n";

  const publicKey =
    "-----BEGIN RSA PUBLIC KEY-----\n" +
    "MIGJAoGBAKdVz2lIbQi1YU3Z0qRizpV9gAMW9Kmwms4aP+r7CKcu4w9/fMcV4v6P\n" +
    "zYHwnjvTEZ6gSqtxcpwT6EgBAgxFolqjeInOis2I+tcfxcShwcfMZ/E7kgktP15w\n" +
    "dsAFDTzmso9VtnBNgbt8afNea1nK25Fa+Zq+gztxkI5pkw1WFm4FAgMBAAE=\n" +
    "-----END RSA PUBLIC KEY-----\n";

  const d =
    "TN1F4P671vw6LiCYeZpJerGjU8f/qtLMyU+VfMLDPshy1HOjRW/wTS6RH9b/WEukFFFc+1OpabhbQnf0EN8LrAib0RrZKAPtxCsDyzB66r/crT+2TYjFIm1gLNdfcnSrMpdfbgFBJl4NkRBSYHm+Q6MoCny7za0K3FP1sZK1ZQE=";
  const dp =
    "yIhhYhpsCD6QIvgJ7yHEYEsS5EGhbLzgmTsAsed5fotMn/iDkSF+3/oUn9OdzpeI1eXwsSznggK9lqBlQ5kMsQ==";
  const dq =
    "fwJtLJjBJ/o8ZJ4OLz26Qdep8Dfelaltet5ncTxc+YR9NFOWft0pQBu0gYCGLw2aYNcFbmoayqHYSmES97qPbQ==";
  const e = "AQAB";
  const n =
    "p1XPaUhtCLVhTdnSpGLOlX2AAxb0qbCazho/6vsIpy7jD398xxXi/o/NgfCeO9MRnqBKq3FynBPoSAECDEWiWqN4ic6KzYj61x/FxKHBx8xn8TuSCS0/XnB2wAUNPOayj1W2cE2Bu3xp815rWcrbkVr5mr6DO3GQjmmTDVYWbgU=";
  const p =
    "1dQKVwjhdrXAz/WoT6/X4728q9t4V36zrYLelzrZ9rTl/3i61wcFwyz+pmy8CrfqQ4VOApKIoUBqu/DjZuGSCQ==";
  const q =
    "yFZiSv8BqXQHEPPo/S8G4S+01Ie3R7/kOeqcCpiuR9avpFLArpypE54ciONUPgHLrhx98qbL6O+GIP8dac6LHQ==";
  const qi =
    "DNtq71ngu8GSu7iFTbVJQNQQJ/SMOrkRbEP8ugj34wH30FY5DYmKlKLvxlp1eolH/sE2GhzvJd1avuYtA+YQVw==";

  test("should encode both keys", () => {
    expect(createRsaJwk({ id, privateKey, publicKey, type })).toStrictEqual({
      d,
      dp,
      dq,
      e,
      n,
      p,
      q,
      qi,
      kid,
      kty,
    });
  });

  test("should encode public key", () => {
    expect(createRsaJwk({ id, publicKey, type })).toStrictEqual({ e, n, kid, kty });
  });

  test("should decode both keys", () => {
    expect(createRsaPem({ d, dp, dq, e, n, p, q, qi, kid, kty })).toStrictEqual({
      id,
      privateKey:
        "-----BEGIN RSA PRIVATE KEY-----\n" +
        "MIICXAIBAAKBgQCnVc9pSG0ItWFN2dKkYs6VfYADFvSpsJrOGj/q+winLuMPf3zH\n" +
        "FeL+j82B8J470xGeoEqrcXKcE+hIAQIMRaJao3iJzorNiPrXH8XEocHHzGfxO5IJ\n" +
        "LT9ecHbABQ085rKPVbZwTYG7fGnzXmtZytuRWvmavoM7cZCOaZMNVhZuBQIDAQAB\n" +
        "AoGATN1F4P671vw6LiCYeZpJerGjU8f/qtLMyU+VfMLDPshy1HOjRW/wTS6RH9b/\n" +
        "WEukFFFc+1OpabhbQnf0EN8LrAib0RrZKAPtxCsDyzB66r/crT+2TYjFIm1gLNdf\n" +
        "cnSrMpdfbgFBJl4NkRBSYHm+Q6MoCny7za0K3FP1sZK1ZQECQQDV1ApXCOF2tcDP\n" +
        "9ahPr9fjvbyr23hXfrOtgt6XOtn2tOX/eLrXBwXDLP6mbLwKt+pDhU4CkoihQGq7\n" +
        "8ONm4ZIJAkEAyFZiSv8BqXQHEPPo/S8G4S+01Ie3R7/kOeqcCpiuR9avpFLArpyp\n" +
        "E54ciONUPgHLrhx98qbL6O+GIP8dac6LHQJBAMiIYWIabAg+kCL4Ce8hxGBLEuRB\n" +
        "oWy84Jk7ALHneX6LTJ/4g5Ehft/6FJ/Tnc6XiNXl8LEs54ICvZagZUOZDLECQH8C\n" +
        "bSyYwSf6PGSeDi89ukHXqfA33pWpbXreZ3E8XPmEfTRTln7dKUAbtIGAhi8NmmDX\n" +
        "BW5qGsqh2EphEve6j20CQAzbau9Z4LvBkru4hU21SUDUECf0jDq5EWxD/LoI9+MB\n" +
        "99BWOQ2JipSi78ZadXqJR/7BNhoc7yXdWr7mLQPmEFc=\n" +
        "-----END RSA PRIVATE KEY-----\n",
      publicKey,
      type,
    });
  });

  test("should decode public key", () => {
    expect(createRsaPem({ e, n, kid, kty })).toStrictEqual({
      id,
      publicKey,
      type,
    });
  });

  test("should resolve a valid public key", () => {
    const { publicKey: decodedPublicKey } = createRsaPem({ e, n, kid, kty });
    const signature = sign(privateKey, "input");

    expect(verify(decodedPublicKey!, "input", signature)).toBe(true);
  });

  test("should resolve a valid private key", () => {
    const { privateKey: decodedPrivateKey } = createRsaPem({
      d,
      dp,
      dq,
      e,
      n,
      p,
      q,
      qi,
      kid,
      kty,
    });
    const signature = sign(decodedPrivateKey!, "input");

    expect(verify(publicKey, "input", signature)).toBe(true);
  });
});
