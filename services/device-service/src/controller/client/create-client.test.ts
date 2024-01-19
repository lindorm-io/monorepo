import { createMockMongoRepository } from "@lindorm-io/mongo";
import { PublicKey } from "../../entity";
import { createTestClient, createTestPublicKey } from "../../fixtures/entity";
import { RSA_KEY_SET } from "../../fixtures/integration/rsa-keys.fixture";
import { createClientController } from "./create-client";

describe("createClientController", () => {
  let ctx: any;

  beforeEach(() => {
    const pem = RSA_KEY_SET.export("pem");

    ctx = {
      data: {
        id: "871f3782-6ef8-4f93-9612-f556438c9843",
        name: "Test Client",
        publicKey: pem.publicKey,
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
    expect(ctx.mongo.publicKeyRepository.create).toHaveBeenCalledWith(expect.any(PublicKey));
  });
});
