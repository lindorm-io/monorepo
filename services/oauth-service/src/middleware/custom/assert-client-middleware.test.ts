import { Client } from "../../entity";
import { ClientError } from "@lindorm-io/errors";
import { assertClientMiddleware } from "./assert-client-middleware";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import { createTestClient } from "../../fixtures/entity";

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

describe("assertClientSecretMiddleware", () => {
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
    await expect(assertClientMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.entity.client).toStrictEqual(expect.any(Client));
  });

  test("should resolve with assertion on data", async () => {
    await expect(assertClientMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(cryptoAssert).toHaveBeenCalled();
  });

  test("should fallback to header assertion", async () => {
    ctx.data = {};

    await expect(assertClientMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.getAuthorizationHeader).toHaveBeenCalled();
    expect(cryptoAssert).toHaveBeenCalled();
  });

  test("should skip assertion of secret", async () => {
    ctx.data.clientSecret = undefined;

    await expect(assertClientMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(cryptoAssert).not.toHaveBeenCalled();
  });

  test("should throw on invalid assertion", async () => {
    cryptoAssert.mockRejectedValueOnce(new Error("message"));

    await expect(assertClientMiddleware(ctx, next)).rejects.toThrow(ClientError);
  });

  test("should throw on invalid client", async () => {
    ctx.mongo.clientRepository.find.mockResolvedValue(createTestClient({ active: false }));

    await expect(assertClientMiddleware(ctx, next)).rejects.toThrow(ClientError);
  });
});
