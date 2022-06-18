import { createClientController } from "./create-client";
import { createMockCache } from "@lindorm-io/redis";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestClient, createTestTenant } from "../../fixtures/entity";

jest.mock("@lindorm-io/core", () => ({
  ...(jest.requireActual("@lindorm-io/core") as object),

  randomString: jest.fn().mockImplementation(() => "random-string"),
}));

jest.mock("../../instance", () => ({
  argon: {
    encrypt: jest.fn().mockResolvedValue("encrypted-string"),
  },
}));

describe("createClientController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        clientCache: createMockCache(createTestClient),
      },
      data: {
        description: "description",
        host: "host",
        logoutUri: "logoutUri",
        name: "name",
        redirectUris: ["redirectUri"],
      },
      entity: {
        tenant: createTestTenant(),
      },
      repository: {
        clientRepository: createMockRepository(createTestClient),
      },
    };
  });

  test("should resolve created client", async () => {
    await expect(createClientController(ctx)).resolves.toStrictEqual({
      body: {
        id: expect.any(String),
        secret: "random-string",
      },
      status: 201,
    });

    expect(ctx.repository.clientRepository.create).toHaveBeenCalled();
    expect(ctx.cache.clientCache.create).toHaveBeenCalled();
  });
});
