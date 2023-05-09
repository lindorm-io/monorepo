import { ClientError } from "@lindorm-io/errors";
import { createOpaqueToken } from "@lindorm-io/jwt";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import { createMockRedisRepository } from "@lindorm-io/redis";
import jwt from "jsonwebtoken";
import MockDate from "mockdate";
import {
  createTestAccessToken,
  createTestClient,
  createTestClientSession,
  createTestRefreshToken,
} from "../../fixtures/entity";
import { convertOpaqueTokenToJwt as _convertOpaqueTokenToJwt } from "../../handler";
import { tokenExchangeController } from "./exchange";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../handler");

const convertOpaqueTokenToJwt = _convertOpaqueTokenToJwt as jest.Mock;

describe("tokenExchangeController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        token: createOpaqueToken(),
      },
      mongo: {
        clientRepository: createMockMongoRepository(createTestClient),
        clientSessionRepository: createMockMongoRepository(createTestClientSession),
      },
      redis: {
        opaqueTokenCache: createMockRedisRepository(createTestAccessToken),
      },
    };

    convertOpaqueTokenToJwt.mockImplementation(() => ({ token: "jwt.jwt.jwt", expiresIn: 999 }));
  });

  test("should resolve token info", async () => {
    await expect(tokenExchangeController(ctx)).resolves.toStrictEqual({
      body: { expiresIn: 999, token: "jwt.jwt.jwt" },
    });
  });

  test("should throw on invalid token header", async () => {
    ctx.data.token = jwt.sign({}, "secret");

    await expect(tokenExchangeController(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on missing token", async () => {
    ctx.redis.opaqueTokenCache.tryFind.mockResolvedValue(undefined);

    await expect(tokenExchangeController(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on invalid token type", async () => {
    ctx.redis.opaqueTokenCache.tryFind.mockResolvedValue(createTestRefreshToken());

    await expect(tokenExchangeController(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on missing client", async () => {
    ctx.mongo.clientRepository.tryFind.mockResolvedValue(undefined);

    await expect(tokenExchangeController(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on inactive client", async () => {
    ctx.mongo.clientRepository.tryFind.mockResolvedValue(createTestClient({ active: false }));

    await expect(tokenExchangeController(ctx)).rejects.toThrow(ClientError);
  });
});
