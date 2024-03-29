import { createMockLogger } from "@lindorm-io/core-logger";
import MockDate from "mockdate";
import nock from "nock";
import { getKeysFromJwks } from "./get-keys-from-jwks";

MockDate.set("2021-01-01T08:00:00.000Z");

nock("https://test.lindorm.io")
  .get("/.well-known/jwks.json")
  .times(1)
  .reply(200, {
    keys: [
      {
        alg: "ES512",
        crv: "P-521",
        key_ops: ["verify"],
        kid: "391a4598-5dc6-4e3c-b1d9-a971ac55b3bb",
        kty: "EC",
        origin: "https://origin.uri",
        use: "sig",
        d: "AJk+YtHhPoobRdEZXzK9URIT7mB7dvGYeH6TmK8kP06Ha/lVRX8f/zD9vc9CRik+fb6XkcTMxktFNve1Xkq3HbMu",
        x: "AAsJtfdgSmaSxsm1swOSCodmSxeEwxQ1vcdkLVySpZAGLcGZYNIvJ9cUtQGQc9S3CDvjkR0bkrxq4HLYqC4Kwodz",
        y: "AJcSMpJWmZ97gv03gXIIbH57p01RN6CpVcUTXW+s4NxnQ6UDhuWKeyBdB7F14rXQZQKhvluoGpjvv6ON4bdk2wuW",
      },
    ],
  });

describe("getKeysFromJwks", () => {
  let options: any;

  beforeEach(() => {
    options = {
      host: "https://test.lindorm.io",
      alias: "Alias",
    };
  });

  test("should resolve", async () => {
    const keys = await getKeysFromJwks(options, createMockLogger());

    expect(keys.map((key) => key.jwk("both"))).toStrictEqual([
      {
        alg: "ES512",
        crv: "P-521",
        d: "AJk-YtHhPoobRdEZXzK9URIT7mB7dvGYeH6TmK8kP06Ha_lVRX8f_zD9vc9CRik-fb6XkcTMxktFNve1Xkq3HbMu",
        exp: undefined,
        expires_in: undefined,
        iat: 1609488000,
        jku: "https://test.lindorm.io/.well-known/jwks.json",
        key_ops: ["verify"],
        kid: "391a4598-5dc6-4e3c-b1d9-a971ac55b3bb",
        kty: "EC",
        nbf: 1609488000,
        owner_id: undefined,
        uat: 1609488000,
        use: "sig",
        x: "AAsJtfdgSmaSxsm1swOSCodmSxeEwxQ1vcdkLVySpZAGLcGZYNIvJ9cUtQGQc9S3CDvjkR0bkrxq4HLYqC4Kwodz",
        y: "AJcSMpJWmZ97gv03gXIIbH57p01RN6CpVcUTXW-s4NxnQ6UDhuWKeyBdB7F14rXQZQKhvluoGpjvv6ON4bdk2wuW",
      },
    ]);

    expect(keys.map((key) => key.isExternal)).toStrictEqual([true]);
  });
});
