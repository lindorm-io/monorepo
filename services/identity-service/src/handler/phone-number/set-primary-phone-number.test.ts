import { PhoneNumber } from "../../entity";
import { createMockLogger } from "@lindorm-io/winston";
import { setPrimaryPhoneNumber } from "./set-primary-phone-number";

describe("setPrimaryPhoneNumber", () => {
  const phone1 = new PhoneNumber({
    identityId: "identityId",
    phoneNumber: "phoneNumber1",
    primary: true,
    verified: true,
  });
  const phone2 = new PhoneNumber({
    identityId: "identityId",
    phoneNumber: "phoneNumber2",
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
          find: jest.fn().mockResolvedValueOnce(phone1).mockResolvedValueOnce(phone2),
          update: jest.fn(),
        },
      },
    };
    options = {
      identityId: "identityId",
      phoneNumber: "phoneNumber2",
    };
  });

  test("should set new phone number as primary", async () => {
    await expect(setPrimaryPhoneNumber(ctx, options)).resolves.toBeUndefined();

    expect(ctx.repository.phoneNumberRepository.update.mock.calls[0][0]).toStrictEqual(
      expect.objectContaining({
        phoneNumber: "phoneNumber1",
        primary: false,
      }),
    );
    expect(ctx.repository.phoneNumberRepository.update.mock.calls[1][0]).toStrictEqual(
      expect.objectContaining({
        phoneNumber: "phoneNumber2",
        primary: true,
      }),
    );
  });
});
