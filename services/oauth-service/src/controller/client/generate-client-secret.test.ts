import { createMockCache } from "@lindorm-io/redis";
import { createMockRepository } from "@lindorm-io/mongo";
import { generateClientSecretController } from "./generate-client-secret";
import { createTestClient } from "../../fixtures/entity";

jest.mock("@lindorm-io/core", () => ({
  ...(jest.requireActual("@lindorm-io/core") as object),

  randomString: jest.fn().mockImplementation(() => "random-string"),
}));

jest.mock("../../instance", () => ({
  argon: {
    encrypt: jest.fn().mockResolvedValue("encrypted-string"),
  },
}));

describe("generateClientSecretController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        clientCache: createMockCache(createTestClient),
      },
      entity: {
        client: createTestClient(),
      },
      repository: {
        clientRepository: createMockRepository(createTestClient),
      },
    };
  });

  test("should resolve updated client", async () => {
    await expect(generateClientSecretController(ctx)).resolves.toStrictEqual({
      body: {
        secret: "random-string",
      },
    });

    expect(ctx.repository.clientRepository.update).toHaveBeenCalled();
    expect(ctx.cache.clientCache.update).toHaveBeenCalled();
  });
});
