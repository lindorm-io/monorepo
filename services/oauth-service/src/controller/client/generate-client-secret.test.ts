import { createMockRepository } from "@lindorm-io/mongo";
import { createTestClient } from "../../fixtures/entity";
import { generateClientSecretController } from "./generate-client-secret";

jest.mock("@lindorm-io/random", () => ({
  ...(jest.requireActual("@lindorm-io/random") as object),

  randomUnreserved: jest.fn().mockImplementation(() => "random-string"),
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
  });
});
