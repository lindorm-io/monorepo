import { ClientError } from "@lindorm-io/errors";
import { PhoneNumber } from "../../entity";
import { createMockLogger } from "@lindorm-io/winston";
import { verifyPhoneNumberConnectSession } from "./verify-phone-number-connect-session";

jest.mock("../../instance", () => ({
  argon: {
    assert: jest.fn().mockImplementation(async () => {}),
  },
}));

describe("connectPhoneNumberVerify", () => {
  const phone1 = new PhoneNumber({
    identityId: "identityId",
    phoneNumber: "phoneNumber",
    primary: false,
    verified: false,
  });

  let ctx: any;
  let session: any;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
      repository: {
        phoneNumberRepository: {
          find: jest.fn().mockResolvedValue(phone1),
          update: jest.fn(),
        },
      },
    };
    session = {
      code: "code",
      identifier: "phoneNumber",
    };
  });

  test("should verify connect session and set phone number as verified", async () => {
    await expect(verifyPhoneNumberConnectSession(ctx, session, "code")).resolves.toBeUndefined();

    expect(ctx.repository.phoneNumberRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        phoneNumber: "phoneNumber",
        verified: true,
      }),
    );
  });

  test("should throw if phone number is already verified", async () => {
    phone1.verified = true;

    await expect(verifyPhoneNumberConnectSession(ctx, session, "code")).rejects.toThrow(
      ClientError,
    );
  });
});
