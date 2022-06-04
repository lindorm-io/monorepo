import { createMockCache } from "@lindorm-io/redis";
import { createMockRepository } from "@lindorm-io/mongo";
import { generateClientSecretController } from "./generate-client-secret";
import { getTestClient } from "../../test/entity";

jest.mock("@lindorm-io/core", () => ({
  ...(jest.requireActual("@lindorm-io/core") as object),
  getRandomString: jest.fn().mockImplementation(() => "random-string"),
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
        clientCache: createMockCache(),
      },
      entity: {
        client: getTestClient(),
      },
      repository: {
        clientRepository: createMockRepository(),
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
