import MockDate from "mockdate";
import { createMockLogger } from "@lindorm-io/winston";
import { createTestKeyPairRSA } from "@lindorm-io/key-pair";
import { getKeysFromJwks } from "./get-keys-from-jwks";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("@lindorm-io/axios", () => ({
  Axios: class Axios {
    async get() {
      return {
        data: {
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
        },
      };
    }
  },
}));

describe("getKeysFromJwks", () => {
  let options: any;

  beforeEach(() => {
    options = {
      currentKeys: [createTestKeyPairRSA()],
      host: "host",
      logger: createMockLogger(),
    };
  });

  test("should resolve", async () => {
    await expect(getKeysFromJwks(options)).resolves.toMatchSnapshot();
  });
});
