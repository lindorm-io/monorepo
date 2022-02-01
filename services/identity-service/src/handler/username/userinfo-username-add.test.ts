import { userinfoUsernameAdd } from "./userinfo-username-add";
import { Identity } from "../../entity";
import { logger } from "../../test/logger";

describe("userinfoUsernameAdd", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      logger,
      repository: {
        identityRepository: {
          update: jest.fn(),
        },
      },
    };
  });

  test("should update identity with preferred username", async () => {
    await expect(
      userinfoUsernameAdd(
        ctx,
        new Identity({
          preferredUsername: "preferredUsername",
        }),
      ),
    ).resolves.toBeUndefined();

    expect(ctx.repository.identityRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        username: "preferredUsername",
      }),
    );
  });

  test("should ignore when username is already set", async () => {
    await expect(
      userinfoUsernameAdd(
        ctx,
        new Identity({
          preferredUsername: "preferredUsername",
          username: "username",
        }),
      ),
    ).resolves.toBeUndefined();

    expect(ctx.repository.identityRepository.update).not.toHaveBeenCalled();
  });

  test("should ignore when there is no preferred username", async () => {
    await expect(userinfoUsernameAdd(ctx, new Identity({}))).resolves.toBeUndefined();

    expect(ctx.repository.identityRepository.update).not.toHaveBeenCalled();
  });
});
