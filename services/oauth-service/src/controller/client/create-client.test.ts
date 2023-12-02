import { createMockMongoRepository } from "@lindorm-io/mongo";
import { createTestClient, createTestTenant } from "../../fixtures/entity";
import { createClientController } from "./create-client";

jest.mock("@lindorm-io/random", () => ({
  ...(jest.requireActual("@lindorm-io/random") as object),

  randomUnreserved: jest.fn().mockReturnValue("random-string"),
}));

jest.mock("../../instance", () => ({
  argon: {
    sign: jest.fn().mockResolvedValue("encrypted-string"),
  },
}));

describe("createClientController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        description: "description",
        domain: "domain",
        logoutUri: "logoutUri",
        name: "name",
        redirectUris: ["redirectUri"],
      },
      entity: {
        tenant: createTestTenant(),
      },
      mongo: {
        clientRepository: createMockMongoRepository(createTestClient),
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

    expect(ctx.mongo.clientRepository.create).toHaveBeenCalled();
  });
});
