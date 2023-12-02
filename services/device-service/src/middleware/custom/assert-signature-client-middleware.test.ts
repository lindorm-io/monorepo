import { ClientError, ServerError } from "@lindorm-io/errors";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import { createTestClient, createTestPublicKey } from "../../fixtures/entity";
import { assertSignatureClientMiddleware } from "./assert-signature-client-middleware";

describe("assertSignatureClientMiddleware", () => {
  let ctx: any;
  let next: () => Promise<void>;

  beforeEach(() => {
    ctx = {
      entity: {
        publicKey: createTestPublicKey(),
      },
      mongo: {
        clientRepository: createMockMongoRepository((opts) =>
          createTestClient({
            ...opts,
            id: "56b42a4d-ebe1-47ad-bbba-b54169079570",
          }),
        ),
      },
      token: {
        bearerToken: {
          subject: "56b42a4d-ebe1-47ad-bbba-b54169079570",
        },
      },
      get: jest.fn().mockImplementation((key: string) => {
        switch (key) {
          default:
            return "value";
        }
      }),
    };

    next = () => Promise.resolve();
  });

  test("should resolve", async () => {
    await expect(assertSignatureClientMiddleware(ctx, next)).resolves.not.toThrow();

    expect(ctx.mongo.clientRepository.find).toHaveBeenCalled();
  });

  test("should throw on server error", async () => {
    ctx.entity.publicKey = undefined;

    await expect(assertSignatureClientMiddleware(ctx, next)).rejects.toThrow(ServerError);
  });

  test("should throw on subject mismatch", async () => {
    ctx.token.bearerToken.subject = "wrong";

    await expect(assertSignatureClientMiddleware(ctx, next)).rejects.toThrow(ClientError);
  });
});
