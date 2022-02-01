import { EntityNotFoundError } from "@lindorm-io/entity";
import { Email } from "../../entity";
import { userinfoEmailAdd } from "./userinfo-email-add";
import { logger } from "../../test/logger";

describe("userinfoEmailAdd", () => {
  const email1 = new Email({
    identityId: "identityId",
    email: "email1",
    primary: true,
    verified: true,
  });

  let ctx: any;
  let options: any;

  beforeEach(() => {
    ctx = {
      logger,
      repository: {
        emailRepository: {
          count: jest.fn().mockResolvedValue(0),
          create: jest.fn().mockImplementation(async (entity: any) => entity),
          find: jest.fn().mockResolvedValue(email1),
        },
      },
    };
    options = {
      identityId: "identityId",
      email: "email",
    };
  });

  test("should resolve with found email", async () => {
    await expect(userinfoEmailAdd(ctx, options)).resolves.toStrictEqual(email1);
  });

  test("should resolve with new email", async () => {
    ctx.repository.emailRepository.find.mockRejectedValue(new EntityNotFoundError("message"));

    await expect(userinfoEmailAdd(ctx, options)).resolves.toStrictEqual(
      expect.objectContaining({
        identityId: "identityId",
        email: "email",
        primary: true,
        verified: false,
      }),
    );
  });

  test("should not set as primary when there already are emails attached to identity", async () => {
    ctx.repository.emailRepository.count.mockResolvedValue(1);
    ctx.repository.emailRepository.find.mockRejectedValue(new EntityNotFoundError("message"));

    await expect(userinfoEmailAdd(ctx, options)).resolves.toStrictEqual(
      expect.objectContaining({
        email: "email",
        primary: false,
      }),
    );
  });
});
