import { EntityNotFoundError } from "@lindorm-io/entity";
import { PhoneNumber } from "../../entity";
import { createMockLogger } from "@lindorm-io/winston";
import { userinfoPhoneNumberAdd } from "./userinfo-phone-number-add";

describe("userinfoPhoneNumberAdd", () => {
  const phone1 = new PhoneNumber({
    identityId: "identityId",
    phoneNumber: "phoneNumber1",
    primary: true,
    verified: true,
  });

  let ctx: any;
  let options: any;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
      repository: {
        phoneNumberRepository: {
          count: jest.fn().mockResolvedValue(0),
          create: jest.fn().mockImplementation(async (entity: any) => entity),
          find: jest.fn().mockResolvedValue(phone1),
        },
      },
    };
    options = {
      identityId: "identityId",
      phoneNumber: "phoneNumber",
    };
  });

  test("should resolve with found phone number", async () => {
    await expect(userinfoPhoneNumberAdd(ctx, options)).resolves.toStrictEqual(phone1);
  });

  test("should resolve with new phone number", async () => {
    ctx.repository.phoneNumberRepository.find.mockRejectedValue(new EntityNotFoundError("message"));

    await expect(userinfoPhoneNumberAdd(ctx, options)).resolves.toStrictEqual(
      expect.objectContaining({
        identityId: "identityId",
        phoneNumber: "phoneNumber",
        primary: true,
        verified: false,
      }),
    );
  });

  test("should not set as primary when there already are phones attached to identity", async () => {
    ctx.repository.phoneNumberRepository.count.mockResolvedValue(1);
    ctx.repository.phoneNumberRepository.find.mockRejectedValue(new EntityNotFoundError("message"));

    await expect(userinfoPhoneNumberAdd(ctx, options)).resolves.toStrictEqual(
      expect.objectContaining({
        phoneNumber: "phoneNumber",
        primary: false,
      }),
    );
  });
});
