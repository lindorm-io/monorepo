import { ClientError } from "@lindorm-io/errors";
import { Identifier, Identity } from "../../entity";
import { IdentifierType } from "../../common";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestEmailIdentifier, createTestIdentity } from "../../fixtures/entity";
import { findVerifiedIdentifier } from "./find-verified-identifier";

describe("findVerifiedIdentifier", () => {
  let ctx: any;
  let identity: Identity;

  beforeEach(() => {
    ctx = {
      data: {
        identifier: "identifier",
        provider: "provider",
        type: "type",
      },
      repository: {
        identifierRepository: createMockRepository(createTestEmailIdentifier),
      },
    };

    identity = createTestIdentity();
  });

  test("should resolve", async () => {
    await expect(
      findVerifiedIdentifier(ctx, identity, {
        identifier: "identifier",
        provider: "provider",
        type: IdentifierType.EMAIL,
      }),
    ).resolves.toStrictEqual(expect.any(Identifier));
  });

  test("should reject unverified identifier", async () => {
    ctx.repository.identifierRepository.find.mockResolvedValue(
      createTestEmailIdentifier({
        verified: false,
      }),
    );

    await expect(
      findVerifiedIdentifier(ctx, identity, {
        identifier: "identifier",
        provider: "provider",
        type: IdentifierType.EMAIL,
      }),
    ).rejects.toThrow(ClientError);
  });
});
