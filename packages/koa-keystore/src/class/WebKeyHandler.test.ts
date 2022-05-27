import { WebKeyHandler } from "./WebKeyHandler";
import { WebKeyHandlerError } from "../error";
import { logger } from "../test";

let keys: Array<any> = [];

jest.mock("@lindorm-io/axios", () => ({
  Axios: class Axios {
    get() {
      return { data: { keys } };
    }
  },
}));

describe("JWKSHandler.ts", () => {
  let handler: WebKeyHandler;

  beforeEach(() => {
    keys = [
      {
        alg: "ES512",
        crv: "P-521",
        key_ops: [],
        kid: "391a4598-5dc6-4e3c-b1d9-a971ac55b3bb",
        kty: "EC",
        use: "sig",
        d: "AJk+YtHhPoobRdEZXzK9URIT7mB7dvGYeH6TmK8kP06Ha/lVRX8f/zD9vc9CRik+fb6XkcTMxktFNve1Xkq3HbMu",
        x: "AAsJtfdgSmaSxsm1swOSCodmSxeEwxQ1vcdkLVySpZAGLcGZYNIvJ9cUtQGQc9S3CDvjkR0bkrxq4HLYqC4Kwodz",
        y: "AJcSMpJWmZ97gv03gXIIbH57p01RN6CpVcUTXW+s4NxnQ6UDhuWKeyBdB7F14rXQZQKhvluoGpjvv6ON4bdk2wuW",
      },
    ];

    handler = new WebKeyHandler({
      host: "https://lindorm.io/",
      logger,
      name: "name",
      port: 4000,
    });
  });

  test("should get keys", async () => {
    await expect(handler.getKeys()).resolves.toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          algorithms: ["ES512"],
          expires: null,
          id: "391a4598-5dc6-4e3c-b1d9-a971ac55b3bb",
          namedCurve: "P-521",
          passphrase: null,
          preferredAlgorithm: "ES512",
          type: "EC",
          version: 0,
        }),
      ]),
    );
  });

  test("should throw error if there are no keys", async () => {
    keys = [];

    await expect(handler.getKeys()).rejects.toThrow(WebKeyHandlerError);
  });
});
