import { ClientError } from "@lindorm-io/errors";
import { PhoneNumber } from "../../entity";
import { createMockLogger } from "@lindorm-io/winston";
import { removePhoneNumber } from "./remove-phone-number";

describe("removePhoneNumber", () => {
  const phone1 = new PhoneNumber({
    identityId: "identityId",
    phoneNumber: "phoneNumber",
    primary: false,
    verified: true,
  });

  let ctx: any;
  let options: any;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
      repository: {
        phoneNumberRepository: {
          find: jest.fn().mockResolvedValue(phone1),
          destroy: jest.fn(),
        },
      },
    };
    options = {
      identityId: "identityId",
      phoneNumber: "phoneNumber2",
    };
  });

  test("should remove phone number", async () => {
    await expect(removePhoneNumber(ctx, options)).resolves.toBeUndefined();

    expect(ctx.repository.phoneNumberRepository.destroy).toHaveBeenCalledWith(phone1);
  });

  test("should throw when phone is primary", async () => {
    phone1.primary = true;

    await expect(removePhoneNumber(ctx, options)).rejects.toThrow(ClientError);
  });
});
