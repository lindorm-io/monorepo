import { KeyType, NamedCurve } from "../../../enum";
import { encodeKeys } from "./encode-keys";

describe("encodeKeys", () => {
  describe("EC", () => {
    const privateKey =
      "-----BEGIN PRIVATE KEY-----\n" +
      "MIHuAgEAMBAGByqGSM49AgEGBSuBBAAjBIHWMIHTAgEBBEIAmT5i0eE+ihtF0Rlf\n" +
      "Mr1REhPuYHt28Zh4fpOYryQ/Todr+VVFfx//MP29z0JGKT59vpeRxMzGS0U297Ve\n" +
      "Srcdsy6hgYkDgYYABAALCbX3YEpmksbJtbMDkgqHZksXhMMUNb3HZC1ckqWQBi3B\n" +
      "mWDSLyfXFLUBkHPUtwg745EdG5K8auBy2KguCsKHcwCXEjKSVpmfe4L9N4FyCGx+\n" +
      "e6dNUTegqVXFE11vrODcZ0OlA4blinsgXQexdeK10GUCob5bqBqY77+jjeG3ZNsL\n" +
      "lg==\n" +
      "-----END PRIVATE KEY-----\n";

    const publicKey =
      "-----BEGIN PUBLIC KEY-----\n" +
      "MIGbMBAGByqGSM49AgEGBSuBBAAjA4GGAAQACwm192BKZpLGybWzA5IKh2ZLF4TD\n" +
      "FDW9x2QtXJKlkAYtwZlg0i8n1xS1AZBz1LcIO+ORHRuSvGrgctioLgrCh3MAlxIy\n" +
      "klaZn3uC/TeBcghsfnunTVE3oKlVxRNdb6zg3GdDpQOG5Yp7IF0HsXXitdBlAqG+\n" +
      "W6gamO+/o43ht2TbC5Y=\n" +
      "-----END PUBLIC KEY-----\n";

    test("should encode keys", () => {
      expect(
        encodeKeys({
          exposePrivateKey: true,
          namedCurve: NamedCurve.P521,
          privateKey,
          publicKey,
          type: KeyType.EC,
        }),
      ).toStrictEqual({
        crv: "P-521",
        d: "AJk+YtHhPoobRdEZXzK9URIT7mB7dvGYeH6TmK8kP06Ha/lVRX8f/zD9vc9CRik+fb6XkcTMxktFNve1Xkq3HbMu",
        x: "AAsJtfdgSmaSxsm1swOSCodmSxeEwxQ1vcdkLVySpZAGLcGZYNIvJ9cUtQGQc9S3CDvjkR0bkrxq4HLYqC4Kwodz",
        y: "AJcSMpJWmZ97gv03gXIIbH57p01RN6CpVcUTXW+s4NxnQ6UDhuWKeyBdB7F14rXQZQKhvluoGpjvv6ON4bdk2wuW",
      });
    });
  });

  describe("RSA", () => {
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

    test("should encode keys", () => {
      expect(
        encodeKeys({
          exposePrivateKey: true,
          privateKey,
          publicKey,
          type: KeyType.RSA,
        }),
      ).toStrictEqual({
        d: "TN1F4P671vw6LiCYeZpJerGjU8f/qtLMyU+VfMLDPshy1HOjRW/wTS6RH9b/WEukFFFc+1OpabhbQnf0EN8LrAib0RrZKAPtxCsDyzB66r/crT+2TYjFIm1gLNdfcnSrMpdfbgFBJl4NkRBSYHm+Q6MoCny7za0K3FP1sZK1ZQE=",
        dp: "yIhhYhpsCD6QIvgJ7yHEYEsS5EGhbLzgmTsAsed5fotMn/iDkSF+3/oUn9OdzpeI1eXwsSznggK9lqBlQ5kMsQ==",
        dq: "fwJtLJjBJ/o8ZJ4OLz26Qdep8Dfelaltet5ncTxc+YR9NFOWft0pQBu0gYCGLw2aYNcFbmoayqHYSmES97qPbQ==",
        e: "AQAB",
        n: "p1XPaUhtCLVhTdnSpGLOlX2AAxb0qbCazho/6vsIpy7jD398xxXi/o/NgfCeO9MRnqBKq3FynBPoSAECDEWiWqN4ic6KzYj61x/FxKHBx8xn8TuSCS0/XnB2wAUNPOayj1W2cE2Bu3xp815rWcrbkVr5mr6DO3GQjmmTDVYWbgU=",
        p: "1dQKVwjhdrXAz/WoT6/X4728q9t4V36zrYLelzrZ9rTl/3i61wcFwyz+pmy8CrfqQ4VOApKIoUBqu/DjZuGSCQ==",
        q: "yFZiSv8BqXQHEPPo/S8G4S+01Ie3R7/kOeqcCpiuR9avpFLArpypE54ciONUPgHLrhx98qbL6O+GIP8dac6LHQ==",
        qi: "DNtq71ngu8GSu7iFTbVJQNQQJ/SMOrkRbEP8ugj34wH30FY5DYmKlKLvxlp1eolH/sE2GhzvJd1avuYtA+YQVw==",
      });
    });
  });
});
