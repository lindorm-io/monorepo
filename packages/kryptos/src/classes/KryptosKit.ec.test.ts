import MockDate from "mockdate";
import {
  TEST_EC_KEY_B64,
  TEST_EC_KEY_JWK,
  TEST_EC_KEY_PEM,
} from "../__fixtures__/ec-keys";
import { KryptosKit } from "./KryptosKit";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate.toISOString());

jest.mock("crypto", () => ({
  ...jest.requireActual("crypto"),
  randomUUID: jest.fn().mockReturnValue("6e6f84b0-e125-5e3f-90ae-c65269668d98"),
}));

describe("KryptosKit (EC)", () => {
  describe("clone", () => {
    test("should clone", () => {
      const kryptos = KryptosKit.from.auto(TEST_EC_KEY_B64);
      const cloned = KryptosKit.clone(kryptos);

      expect(cloned.toJSON()).toEqual(kryptos.toJSON());
      expect(cloned.toJWK()).toEqual(kryptos.toJWK());
      expect(cloned.export("b64")).toEqual(kryptos.export("b64"));
    });
  });

  describe("env", () => {
    test("import", () => {
      const kryptos = KryptosKit.env.import(
        "kryptos:eyJlbmMiOiJBMjU2R0NNIiwiaWF0IjoxNzA0MDk2MDAwLCJrZXlfb3BzIjpbInNpZ24iLCJ2ZXJpZnkiXSwibmJmIjoxNzA0MDk2MDAwLCJwdXJwb3NlIjoidGVzdCIsInVhdCI6MTcwNDA5NjAwMCwiY3J2IjoiUC01MjEiLCJ4IjoiQUkzWThoV2xGTjE5Y3VZM0dTRHdHVGFibWQ2MnBpdzFiWXQ1LUdTV3ZhTjhtSlZRbFFNLWhtZ1o5cHNiTWNTQ3dxTV9ZZEZzLXdRai0wMFBmSGczMVZiUiIsInkiOiJBQWdQWlJoZHJzWTNTTE1kWWdWRjJOVmk1SG43U1BMQVcxMzZqODNZODUydS1WWHpHNloxVXI1T0pJOFFoMThxZ3Y4aTdSN3NncE93bXlQNVNZVHlzTW1mIiwiZCI6IkFFd0dLTncwR0s2QTFlUklDVWxMUDVEaUw1eEVuR1hwLTk0RjJ1YUVKTG05SHBFSm9EaVhUMEl5RFZMSFdFWi11MEN2NkFYVFZJVlc3UnY2bmNhaUlHcTMiLCJraWQiOiIxMzYxNzFjNS03Yjc2LTVlMTQtOWJiOC1jNjA1NTE5NzdjNTkiLCJhbGciOiJFQ0RILUVTK0EyNTZHQ01LVyIsInVzZSI6ImVuYyIsImt0eSI6IkVDIn0",
      );

      expect(kryptos.export("b64")).toEqual({
        id: "136171c5-7b76-5e14-9bb8-c60551977c59",
        algorithm: "ECDH-ES+A256GCMKW",
        curve: "P-521",
        privateKey:
          "MIHuAgEAMBAGByqGSM49AgEGBSuBBAAjBIHWMIHTAgEBBEIATAYo3DQYroDV5EgJSUs_kOIvnEScZen73gXa5oQkub0ekQmgOJdPQjINUsdYRn67QK_oBdNUhVbtG_qdxqIgarehgYkDgYYABACN2PIVpRTdfXLmNxkg8Bk2m5netqYsNW2Lefhklr2jfJiVUJUDPoZoGfabGzHEgsKjP2HRbPsEI_tND3x4N9VW0QAID2UYXa7GN0izHWIFRdjVYuR5-0jywFtd-o_N2POdrvlV8xumdVK-TiSPEIdfKoL_Iu0e7IKTsJsj-UmE8rDJnw",
        publicKey:
          "MIGbMBAGByqGSM49AgEGBSuBBAAjA4GGAAQAjdjyFaUU3X1y5jcZIPAZNpuZ3ramLDVti3n4ZJa9o3yYlVCVAz6GaBn2mxsxxILCoz9h0Wz7BCP7TQ98eDfVVtEACA9lGF2uxjdIsx1iBUXY1WLkeftI8sBbXfqPzdjzna75VfMbpnVSvk4kjxCHXyqC_yLtHuyCk7CbI_lJhPKwyZ8",
        type: "EC",
        use: "enc",
      });

      expect(kryptos.toJSON()).toEqual(
        expect.objectContaining({
          id: "136171c5-7b76-5e14-9bb8-c60551977c59",
          encryption: "A256GCM",
          operations: ["sign", "verify"],
          purpose: "test",
        }),
      );
    });

    test("export", () => {
      const kryptos = KryptosKit.from.b64({
        ...TEST_EC_KEY_B64,
        id: "136171c5-7b76-5e14-9bb8-c60551977c59",
        algorithm: "ECDH-ES+A256GCMKW",
        encryption: "A256GCM",
        operations: ["sign", "verify"],
        purpose: null,
        use: "enc",
      });

      expect(KryptosKit.env.export(kryptos)).toEqual(
        "kryptos:eyJjcnYiOiJQLTUyMSIsIngiOiJBSTNZOGhXbEZOMTljdVkzR1NEd0dUYWJtZDYycGl3MWJZdDUtR1NXdmFOOG1KVlFsUU0taG1nWjlwc2JNY1NDd3FNX1lkRnMtd1FqLTAwUGZIZzMxVmJSIiwieSI6IkFBZ1BaUmhkcnNZM1NMTWRZZ1ZGMk5WaTVIbjdTUExBVzEzNmo4M1k4NTJ1LVZYekc2WjFVcjVPSkk4UWgxOHFndjhpN1I3c2dwT3dteVA1U1lUeXNNbWYiLCJkIjoiQUV3R0tOdzBHSzZBMWVSSUNVbExQNURpTDV4RW5HWHAtOTRGMnVhRUpMbTlIcEVKb0RpWFQwSXlEVkxIV0VaLXUwQ3Y2QVhUVklWVzdSdjZuY2FpSUdxMyIsImtpZCI6IjEzNjE3MWM1LTdiNzYtNWUxNC05YmI4LWM2MDU1MTk3N2M1OSIsImFsZyI6IkVDREgtRVMrQTI1NkdDTUtXIiwidXNlIjoiZW5jIiwia3R5IjoiRUMiLCJlbmMiOiJBMjU2R0NNIiwiaWF0IjoxNzA0MDk2MDAwLCJrZXlfb3BzIjpbInNpZ24iLCJ2ZXJpZnkiXSwibmJmIjoxNzA0MDk2MDAwLCJ1YXQiOjE3MDQwOTYwMDB9",
      );
    });
  });

  describe("from", () => {
    describe("auto", () => {
      test("b64", () => {
        const kryptos = KryptosKit.from.auto(TEST_EC_KEY_B64);

        expect(kryptos.toJSON()).toMatchSnapshot();
        expect(kryptos.toJWK()).toMatchSnapshot();
        expect(kryptos.export("b64")).toMatchSnapshot();
      });

      test("jwk", () => {
        const kryptos = KryptosKit.from.auto(TEST_EC_KEY_JWK);

        expect(kryptos.toJSON()).toMatchSnapshot();
        expect(kryptos.toJWK()).toMatchSnapshot();
        expect(kryptos.export("jwk")).toMatchSnapshot();
      });

      test("pem", () => {
        const kryptos = KryptosKit.from.auto(TEST_EC_KEY_PEM);

        expect(kryptos.toJSON()).toMatchSnapshot();
        expect(kryptos.toJWK()).toMatchSnapshot();
        expect(kryptos.export("pem")).toMatchSnapshot();
      });
    });

    test("b64", () => {
      const kryptos = KryptosKit.from.b64(TEST_EC_KEY_B64);

      expect(kryptos.toJSON()).toMatchSnapshot();
      expect(kryptos.toJWK()).toMatchSnapshot();
      expect(kryptos.export("b64")).toMatchSnapshot();
    });

    test("jwk", () => {
      const kryptos = KryptosKit.from.jwk(TEST_EC_KEY_JWK);

      expect(kryptos.toJSON()).toMatchSnapshot();
      expect(kryptos.toJWK()).toMatchSnapshot();
      expect(kryptos.export("jwk")).toMatchSnapshot();
    });

    test("pem", () => {
      const kryptos = KryptosKit.from.pem(TEST_EC_KEY_PEM);

      expect(kryptos.toJSON()).toMatchSnapshot();
      expect(kryptos.toJWK()).toMatchSnapshot();
      expect(kryptos.export("pem")).toMatchSnapshot();
    });
  });

  describe("is", () => {
    test("isEc", () => {
      const kryptos = KryptosKit.from.b64(TEST_EC_KEY_B64);

      expect(KryptosKit.isEc(kryptos)).toBe(true);
    });

    test("isOct", () => {
      const kryptos = KryptosKit.from.b64(TEST_EC_KEY_B64);

      expect(KryptosKit.isOct(kryptos)).toBe(false);
    });

    test("isOkp", () => {
      const kryptos = KryptosKit.from.b64(TEST_EC_KEY_B64);

      expect(KryptosKit.isOkp(kryptos)).toBe(false);
    });

    test("isRsa", () => {
      const kryptos = KryptosKit.from.b64(TEST_EC_KEY_B64);

      expect(KryptosKit.isRsa(kryptos)).toBe(false);
    });
  });

  describe("generate", () => {
    test("auto", () => {
      const kryptos = KryptosKit.generate.auto({
        algorithm: "ES256",
      });

      expect(kryptos.toJSON()).toMatchSnapshot();
      expect(kryptos.export("b64")).toEqual({
        id: "6e6f84b0-e125-5e3f-90ae-c65269668d98",
        algorithm: "ES256",
        curve: "P-256",
        privateKey: expect.any(String),
        publicKey: expect.any(String),
        type: "EC",
        use: "sig",
      });
    });

    test("enc", () => {
      const kryptos = KryptosKit.generate.enc.ec({
        algorithm: "ECDH-ES+A192GCMKW",
        encryption: "A256GCM",
      });

      expect(kryptos.toJSON()).toMatchSnapshot();
      expect(kryptos.export("b64")).toEqual({
        id: "6e6f84b0-e125-5e3f-90ae-c65269668d98",
        algorithm: "ECDH-ES+A192GCMKW",
        curve: "P-384",
        privateKey: expect.any(String),
        publicKey: expect.any(String),
        type: "EC",
        use: "enc",
      });
    });

    test("sig", () => {
      const kryptos = KryptosKit.generate.sig.ec({
        algorithm: "ES256",
      });

      expect(kryptos.toJSON()).toMatchSnapshot();
      expect(kryptos.export("b64")).toEqual({
        id: "6e6f84b0-e125-5e3f-90ae-c65269668d98",
        algorithm: "ES256",
        curve: "P-256",
        privateKey: expect.any(String),
        publicKey: expect.any(String),
        type: "EC",
        use: "sig",
      });
    });
  });
});
