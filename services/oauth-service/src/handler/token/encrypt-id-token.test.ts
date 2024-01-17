import { ServerError } from "@lindorm-io/errors";
import { WebKeySet } from "@lindorm-io/jwk";
import { getKeysFromJwks as _getKeysFromJwks } from "@lindorm-io/koa-keystore";
import { createMockLogger } from "@lindorm-io/winston";
import { Client } from "../../entity";
import { createTestClient } from "../../fixtures/entity";
import { encryptIdToken } from "./encrypt-id-token";

const encryptJwe = jest.fn();
jest.mock("@lindorm-io/jwt", () => ({
  JWE: class JWE {
    encrypt(...args: any[]) {
      encryptJwe(...args);
      return "jwe";
    }
  },
}));

const addKey = jest.fn();
const addKeys = jest.fn();
jest.mock("@lindorm-io/keystore", () => ({
  Keystore: class Keystore {
    addKey(...args: any[]) {
      addKey(...args);
    }
    addKeys(...args: any[]) {
      addKeys(...args);
    }
  },
}));

jest.mock("@lindorm-io/koa-keystore");

const getKeysFromJwks = _getKeysFromJwks as jest.Mock;

describe("encryptIdToken", () => {
  let ctx: any;
  let client: Client;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
    };

    client = createTestClient({
      jwks: ["test"],
    });

    getKeysFromJwks.mockResolvedValue(["key"]);
  });

  afterEach(jest.clearAllMocks);

  test("should resolve with jwk stored on client", async () => {
    await expect(encryptIdToken(ctx, client, "token")).resolves.toBe("jwe");

    expect(getKeysFromJwks).not.toHaveBeenCalled();
    expect(addKey).toHaveBeenCalledWith(expect.any(WebKeySet));
    expect(encryptJwe).toHaveBeenCalledWith("token");
  });

  test("should resolve with jwk from uri", async () => {
    client.jwks = [];

    await expect(encryptIdToken(ctx, client, "token")).resolves.toBe("jwe");

    expect(getKeysFromJwks).toHaveBeenCalled();
    expect(addKeys).toHaveBeenCalledWith(["key"]);
    expect(encryptJwe).toHaveBeenCalledWith("token");
  });

  test("should throw on missing id token algorithm", async () => {
    client.idTokenEncryption.algorithm = null;

    await expect(encryptIdToken(ctx, client, "token")).rejects.toThrow(ServerError);
  });
});
