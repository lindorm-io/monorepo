import { isPem } from "./is-pem";

describe("isPem", () => {
  test("should return true for EC PEM", () => {
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

    expect(
      isPem({
        curve: "P-521",
        privateKey,
        publicKey,
        type: "EC",
      }),
    ).toBe(true);
  });

  test("should return true for RSA PEM", () => {
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

    expect(
      isPem({
        privateKey,
        publicKey,
        type: "RSA",
      }),
    ).toBe(true);
  });
});
