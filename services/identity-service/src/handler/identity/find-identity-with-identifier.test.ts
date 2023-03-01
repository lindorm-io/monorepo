import { createMockRepository } from "@lindorm-io/mongo";
import { createTestEmailIdentifier, createTestIdentity } from "../../fixtures/entity";
import { findIdentityWithIdentifier } from "./find-identity-with-identifier";
import { Identity } from "../../entity";
import { IdentifierType } from "@lindorm-io/common-types";

describe("findIdentityWithIdentifier", () => {
  let ctx: any;
  let options: any;

  beforeEach(() => {
    ctx = {
      repository: {
        identifierRepository: createMockRepository(createTestEmailIdentifier),
        identityRepository: createMockRepository(createTestIdentity),
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

    expect(ctx.repository.identifierRepository.tryFind).toHaveBeenCalledWith({
      provider: "provider",
      type: IdentifierType.NIN,
      value: "198701028844",
      verified: true,
    });
  });

  test("should resolve undefined", async () => {
    ctx.repository.identifierRepository.tryFind.mockResolvedValue(undefined);

    await expect(findIdentityWithIdentifier(ctx, options)).resolves.toBeUndefined();
  });
});
