import { OpenIdClientType } from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import { Client } from "../../entity";
import { createTestClient } from "../../fixtures/entity";
import { authenticateClientMiddleware } from "./authenticate-client-middleware";

const cryptoAssert = jest.fn();
jest.mock("@lindorm-io/crypto", () => ({
  CryptoArgon: class CryptoArgon {
    async assert(...args: any) {
      return cryptoAssert(...args);
    }
    async encrypt(arg: any) {
      return `${arg}-signature`;
    }
  },
}));

jest.mock("@lindorm-io/koa-basic-auth", () => ({
  getCredentials: () => ({ username: "username", password: "password" }),
}));

const next = async () => await Promise.resolve();

describe("authenticateClientMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        clientId: "clientId",
        clientSecret: "clientSecret",
      },
      entity: {},
      mongo: {
        clientRepository: createMockMongoRepository(createTestClient),
      },

      getAuthorizationHeader: jest
        .fn()
        .mockImplementation(() => ({ type: "Basic", value: "username:password" })),
    };
  });

  afterEach(jest.clearAllMocks);

  test("should set client on success", async () => {
    await expect(authenticateClientMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.entity.client).toStrictEqual(expect.any(Client));
  });

  test("should resolve with assertion on data", async () => {
    await expect(authenticateClientMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(cryptoAssert).toHaveBeenCalled();
  });

  test("should fallback to header assertion", async () => {
    ctx.data = {};

    await expect(authenticateClientMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.getAuthorizationHeader).toHaveBeenCalled();
    expect(cryptoAssert).toHaveBeenCalled();
  });

  test("should skip assertion of secret", async () => {
    ctx.mongo.clientRepository.find.mockResolvedValue(
      createTestClient({
        type: OpenIdClientType.PUBLIC,
      }),
    );
    ctx.data.clientSecret = undefined;

    await expect(authenticateClientMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(cryptoAssert).not.toHaveBeenCalled();
  });

  test("should throw on invalid assertion", async () => {
    cryptoAssert.mockRejectedValueOnce(new Error("message"));

    await expect(authenticateClientMiddleware(ctx, next)).rejects.toThrow(ClientError);
  });

  test("should throw on invalid client", async () => {
    ctx.mongo.clientRepository.find.mockResolvedValue(createTestClient({ active: false }));

    await expect(authenticateClientMiddleware(ctx, next)).rejects.toThrow(ClientError);
  });
});
