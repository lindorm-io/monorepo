import { createMockMongoRepository } from "@lindorm-io/mongo";
import { createTestClient, createTestPublicKey } from "../../fixtures/entity";
import { createClientController } from "./create-client";

describe("createClientController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        id: "871f3782-6ef8-4f93-9612-f556438c9843",
        name: "Test Client",
        publicKey: "publicKey",
      },
      mongo: {
        clientRepository: createMockMongoRepository(createTestClient),
        publicKeyRepository: createMockMongoRepository(createTestPublicKey),
      },
    };
  });

  test("should create a client", async () => {
    await expect(createClientController(ctx)).resolves.toStrictEqual({
      body: {
        publicKeyId: expect.any(String),
      },
    });

    expect(ctx.mongo.clientRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "871f3782-6ef8-4f93-9612-f556438c9843",
        name: "Test Client",
      }),
    );
    expect(ctx.mongo.publicKeyRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "publicKey",
      }),
    );
  });
});
