import { createMockMongoRepository } from "@lindorm-io/mongo";
import MockDate from "mockdate";
import { createTestEncryptionKey } from "../fixtures/entity";
import { getEncryptionKey } from "./get-encryption-key";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("getEncryptionKey", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      mongo: {
        encryptionKeyRepository: createMockMongoRepository(createTestEncryptionKey),
      },
      token: {
        bearerToken: {
          metadata: { subjectHint: "client" },
          subject: "75887260-62d5-4130-b56c-53aaa5d484c4",
        },
      },
    };
  });

  test("should resolve", async () => {
    await expect(getEncryptionKey(ctx)).resolves.toStrictEqual(expect.any(String));

    expect(ctx.mongo.encryptionKeyRepository.tryFind).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "75887260-62d5-4130-b56c-53aaa5d484c4",
        ownerType: "client",
      }),
    );
    expect(ctx.mongo.encryptionKeyRepository.create).not.toHaveBeenCalled();
  });

  test("should resolve with created", async () => {
    ctx.mongo.encryptionKeyRepository.tryFind.mockResolvedValueOnce(undefined);

    await expect(getEncryptionKey(ctx)).resolves.toStrictEqual(expect.any(String));

    expect(ctx.mongo.encryptionKeyRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "75887260-62d5-4130-b56c-53aaa5d484c4",
        ownerType: "client",
      }),
    );
  });
});
