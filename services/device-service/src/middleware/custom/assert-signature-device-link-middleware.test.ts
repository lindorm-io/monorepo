import { ClientError, ServerError } from "@lindorm-io/errors";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import { createTestDeviceLink, createTestPublicKey } from "../../fixtures/entity";
import { assertSignatureDeviceLinkMiddleware } from "./assert-signature-device-link-middleware";

describe("assertSignatureDeviceLinkMiddleware", () => {
  let ctx: any;
  let next: () => Promise<void>;

  beforeEach(() => {
    ctx = {
      entity: {
        publicKey: createTestPublicKey(),
      },
      mongo: {
        deviceLinkRepository: createMockMongoRepository((opts) =>
          createTestDeviceLink({
            ...opts,
            id: "56b42a4d-ebe1-47ad-bbba-b54169079570",
          }),
        ),
      },
      get: jest.fn().mockImplementation((key: string) => {
        switch (key) {
          case "x-device-link-id":
            return "56b42a4d-ebe1-47ad-bbba-b54169079570";
          case "signature":
            return "signature";
        }
      }),
    };

    next = () => Promise.resolve();
  });

  test("should resolve", async () => {
    await expect(assertSignatureDeviceLinkMiddleware(ctx, next)).resolves.not.toThrow();

    expect(ctx.mongo.deviceLinkRepository.find).toHaveBeenCalled();
  });

  test("should throw on server error", async () => {
    ctx.entity.publicKey = undefined;

    await expect(assertSignatureDeviceLinkMiddleware(ctx, next)).rejects.toThrow(ServerError);
  });

  test("should throw on device link mismatch", async () => {
    ctx.get.mockImplementation((key: string) => {
      switch (key) {
        case "x-device-link-id":
          return "wrong";
        case "signature":
          return "signature";
      }
    });

    await expect(assertSignatureDeviceLinkMiddleware(ctx, next)).rejects.toThrow(ClientError);
  });
});
