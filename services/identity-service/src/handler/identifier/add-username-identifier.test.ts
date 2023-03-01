import { Identity } from "../../entity";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestIdentity } from "../../fixtures/entity";
import { addUsernameIdentifier } from "./add-username-identifier";
import { ClientError } from "@lindorm-io/errors";

describe("addUsernameIdentifier", () => {
  let ctx: any;
  let identity: Identity;

  beforeEach(() => {
    ctx = {
      repository: {
        identityRepository: createMockRepository(createTestIdentity),
      },
    };

    identity = createTestIdentity();
  });

  test("should resolve", async () => {
    ctx.repository.identityRepository.tryFind.mockResolvedValue(undefined);

    await expect(addUsernameIdentifier(ctx, identity, "username")).resolves.not.toThrow();

    expect(ctx.repository.identityRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        preferredUsername: "username",
        username: "username",
      }),
    );
  });

  test("should throw", async () => {
    await expect(addUsernameIdentifier(ctx, identity, "username")).rejects.toThrow(ClientError);
  });
});
