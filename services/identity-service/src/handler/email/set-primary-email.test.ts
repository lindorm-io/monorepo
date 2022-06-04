import { Email } from "../../entity";
import { createMockLogger } from "@lindorm-io/winston";
import { setPrimaryEmail } from "./set-primary-email";

describe("setPrimaryEmail", () => {
  const email1 = new Email({
    identityId: "identityId",
    email: "email1",
    primary: true,
    verified: true,
  });
  const email2 = new Email({
    identityId: "identityId",
    email: "email2",
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
          find: jest.fn().mockResolvedValueOnce(email1).mockResolvedValueOnce(email2),
          update: jest.fn(),
        },
      },
    };
    options = {
      identityId: "identityId",
      email: "email2",
    };
  });

  test("should set new email as primary", async () => {
    await expect(setPrimaryEmail(ctx, options)).resolves.toBeUndefined();

    expect(ctx.repository.emailRepository.update.mock.calls[0][0]).toStrictEqual(
      expect.objectContaining({
        email: "email1",
        primary: false,
      }),
    );
    expect(ctx.repository.emailRepository.update.mock.calls[1][0]).toStrictEqual(
      expect.objectContaining({
        email: "email2",
        primary: true,
      }),
    );
  });
});
