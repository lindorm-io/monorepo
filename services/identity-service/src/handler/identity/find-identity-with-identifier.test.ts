import { IdentifierType } from "@lindorm-io/common-enums";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import { Identity } from "../../entity";
import { createTestEmailIdentifier, createTestIdentity } from "../../fixtures/entity";
import { findIdentityWithIdentifier } from "./find-identity-with-identifier";

describe("findIdentityWithIdentifier", () => {
  let ctx: any;
  let options: any;

  beforeEach(() => {
    ctx = {
      mongo: {
        identifierRepository: createMockMongoRepository(createTestEmailIdentifier),
        identityRepository: createMockMongoRepository(createTestIdentity),
      },
    };

    options = {
      type: IdentifierType.NIN,
      provider: "provider",
      value: "198701028844",
    };
  });

  test("should resolve identity", async () => {
    await expect(findIdentityWithIdentifier(ctx, options)).resolves.toStrictEqual(
      expect.any(Identity),
    );

    expect(ctx.mongo.identifierRepository.tryFind).toHaveBeenCalledWith({
      provider: "provider",
      type: IdentifierType.NIN,
      value: "198701028844",
      verified: true,
    });
  });

  test("should resolve undefined", async () => {
    ctx.mongo.identifierRepository.tryFind.mockResolvedValue(undefined);

    await expect(findIdentityWithIdentifier(ctx, options)).resolves.toBeUndefined();
  });
});
