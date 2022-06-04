import { ClientError } from "@lindorm-io/errors";
import { Email } from "../../entity";
import { createMockLogger } from "@lindorm-io/winston";
import { verifyEmailConnectSession } from "./verify-email-connect-session";

jest.mock("../../instance", () => ({
  argon: {
    assert: jest.fn().mockImplementation(async () => {}),
  },
}));

describe("verifyEmailConnectSession", () => {
  const email1 = new Email({
    identityId: "identityId",
    email: "email",
    primary: false,
    verified: false,
  });

  let ctx: any;
  let session: any;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
      repository: {
        emailRepository: {
          find: jest.fn().mockResolvedValue(email1),
          update: jest.fn(),
        },
      },
    };
    session = {
      code: "code",
      identifier: "email",
    };
  });

  test("should verify connect session and set email as verified", async () => {
    await expect(verifyEmailConnectSession(ctx, session, "code")).resolves.toBeUndefined();

    expect(ctx.repository.emailRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "email",
        verified: true,
      }),
    );
  });

  test("should throw if email is already verified", async () => {
    email1.verified = true;

    await expect(verifyEmailConnectSession(ctx, session, "code")).rejects.toThrow(ClientError);
  });
});
