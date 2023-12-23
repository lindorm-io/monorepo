import { JwkValues } from "../types";
import { jwkToPem } from "./jwk-to-pem";

describe("jwkToPem", () => {
  describe("EC", () => {
    const jwk: JwkValues = {
      crv: "P-521",
      d: "AJk+YtHhPoobRdEZXzK9URIT7mB7dvGYeH6TmK8kP06Ha/lVRX8f/zD9vc9CRik+fb6XkcTMxktFNve1Xkq3HbMu",
      x: "AAsJtfdgSmaSxsm1swOSCodmSxeEwxQ1vcdkLVySpZAGLcGZYNIvJ9cUtQGQc9S3CDvjkR0bkrxq4HLYqC4Kwodz",
      y: "AJcSMpJWmZ97gv03gXIIbH57p01RN6CpVcUTXW+s4NxnQ6UDhuWKeyBdB7F14rXQZQKhvluoGpjvv6ON4bdk2wuW",
      kid: "dfa05b8c-b003-5ada-8a91-5bc6ce95c654",
      kty: "EC",
    };

    test("should decode jwk", () => {
      expect(jwkToPem(jwk)).toStrictEqual({
        id: "dfa05b8c-b003-5ada-8a91-5bc6ce95c654",
        curve: "P-521",
        publicKey:
          "-----BEGIN PUBLIC KEY-----\n" +
          "MIGbMBAGByqGSM49AgEGBSuBBAAjA4GGAAQACwm192BKZpLGybWzA5IKh2ZLF4TD\n" +
          "FDW9x2QtXJKlkAYtwZlg0i8n1xS1AZBz1LcIO+ORHRuSvGrgctioLgrCh3MAlxIy\n" +
          "klaZn3uC/TeBcghsfnunTVE3oKlVxRNdb6zg3GdDpQOG5Yp7IF0HsXXitdBlAqG+\n" +
          "W6gamO+/o43ht2TbC5Y=\n" +
          "-----END PUBLIC KEY-----\n",
        privateKey:
          "-----BEGIN PRIVATE KEY-----\n" +
          "MIHuAgEAMBAGByqGSM49AgEGBSuBBAAjBIHWMIHTAgEBBEIAmT5i0eE+ihtF0Rlf\n" +
          "Mr1REhPuYHt28Zh4fpOYryQ/Todr+VVFfx//MP29z0JGKT59vpeRxMzGS0U297Ve\n" +
          "Srcdsy6hgYkDgYYABAALCbX3YEpmksbJtbMDkgqHZksXhMMUNb3HZC1ckqWQBi3B\n" +
          "mWDSLyfXFLUBkHPUtwg745EdG5K8auBy2KguCsKHcwCXEjKSVpmfe4L9N4FyCGx+\n" +
          "e6dNUTegqVXFE11vrODcZ0OlA4blinsgXQexdeK10GUCob5bqBqY77+jjeG3ZNsL\n" +
          "lg==\n" +
          "-----END PRIVATE KEY-----\n",
        type: "EC",
      });
    });
  });

  describe("RSA", () => {
    const e = "AQAB";
    const d =
      "TN1F4P671vw6LiCYeZpJerGjU8f/qtLMyU+VfMLDPshy1HOjRW/wTS6RH9b/WEukFFFc+1OpabhbQnf0EN8LrAib0RrZKAPtxCsDyzB66r/crT+2TYjFIm1gLNdfcnSrMpdfbgFBJl4NkRBSYHm+Q6MoCny7za0K3FP1sZK1ZQE=";
    const dp =
      "yIhhYhpsCD6QIvgJ7yHEYEsS5EGhbLzgmTsAsed5fotMn/iDkSF+3/oUn9OdzpeI1eXwsSznggK9lqBlQ5kMsQ==";
    const dq =
      "fwJtLJjBJ/o8ZJ4OLz26Qdep8Dfelaltet5ncTxc+YR9NFOWft0pQBu0gYCGLw2aYNcFbmoayqHYSmES97qPbQ==";
    const n =
      "p1XPaUhtCLVhTdnSpGLOlX2AAxb0qbCazho/6vsIpy7jD398xxXi/o/NgfCeO9MRnqBKq3FynBPoSAECDEWiWqN4ic6KzYj61x/FxKHBx8xn8TuSCS0/XnB2wAUNPOayj1W2cE2Bu3xp815rWcrbkVr5mr6DO3GQjmmTDVYWbgU=";
    const p =
      "1dQKVwjhdrXAz/WoT6/X4728q9t4V36zrYLelzrZ9rTl/3i61wcFwyz+pmy8CrfqQ4VOApKIoUBqu/DjZuGSCQ==";
    const q =
      "yFZiSv8BqXQHEPPo/S8G4S+01Ie3R7/kOeqcCpiuR9avpFLArpypE54ciONUPgHLrhx98qbL6O+GIP8dac6LHQ==";
    const qi =
      "DNtq71ngu8GSu7iFTbVJQNQQJ/SMOrkRbEP8ugj34wH30FY5DYmKlKLvxlp1eolH/sE2GhzvJd1avuYtA+YQVw==";

    const jwk: JwkValues = {
      e,
      d,
      dp,
      dq,
      n,
      p,
      q,
      qi,
      kid: "dfa05b8c-b003-5ada-8a91-5bc6ce95c654",
      kty: "RSA",
    };

    test("should decode jwk", () => {
      expect(jwkToPem(jwk)).toStrictEqual({
        id: "dfa05b8c-b003-5ada-8a91-5bc6ce95c654",
        publicKey:
          "-----BEGIN RSA PUBLIC KEY-----\n" +
          "MIGJAoGBAKdVz2lIbQi1YU3Z0qRizpV9gAMW9Kmwms4aP+r7CKcu4w9/fMcV4v6P\n" +
          "zYHwnjvTEZ6gSqtxcpwT6EgBAgxFolqjeInOis2I+tcfxcShwcfMZ/E7kgktP15w\n" +
          "dsAFDTzmso9VtnBNgbt8afNea1nK25Fa+Zq+gztxkI5pkw1WFm4FAgMBAAE=\n" +
          "-----END RSA PUBLIC KEY-----\n",
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
        type: "RSA",
      });
    });
  });

  describe("oct", () => {
    const k = "MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI=";

    test("should encode key", () => {
      expect(
        jwkToPem({
          k,
          kid: "e0a6805f-1c6a-5219-8366-60e0cb39cfed",
          kty: "oct",
        }),
      ).toStrictEqual({
        id: "e0a6805f-1c6a-5219-8366-60e0cb39cfed",
        symmetricKey: "12345678901234567890123456789012",
        type: "oct",
      });
    });
  });
});
