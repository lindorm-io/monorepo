import { ClientError } from "@lindorm-io/errors";
import { Email } from "../../entity";
import { createMockLogger } from "@lindorm-io/winston";
import { removeEmail } from "./remove-email";

describe("removeEmail", () => {
  const email1 = new Email({
    identityId: "identityId",
    email: "email",
    primary: false,
    verified: true,
  });

  let ctx: any;
  let options: any;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
      repository: {
        emailRepository: {
          find: jest.fn().mockResolvedValue(email1),
          destroy: jest.fn(),
        },
      },
    };
    options = {
      identityId: "identityId",
      email: "email2",
    };
  });

  test("should remove email", async () => {
    await expect(removeEmail(ctx, options)).resolves.toBeUndefined();

    expect(ctx.repository.emailRepository.destroy).toHaveBeenCalledWith(email1);
  });

  test("should throw when email is primary", async () => {
    email1.primary = true;

    await expect(removeEmail(ctx, options)).rejects.toThrow(ClientError);
  });
});
