import { PhoneNumber } from "../../entity";
import { logger } from "../../test/logger";
import { userinfoPhoneNumberGet } from "./userinfo-phone-number-get";

describe("userinfoPhoneNumberGet", () => {
  const phone1 = new PhoneNumber({
    identityId: "identityId",
    phoneNumber: "phoneNumber1",
    primary: true,
    verified: true,
    updated: new Date("2021-01-01T08:00:00.000Z"),
  });
  const phone2 = new PhoneNumber({
    identityId: "identityId",
    phoneNumber: "phoneNumber2",
    primary: false,
    verified: true,
    updated: new Date("2021-01-02T08:00:00.000Z"),
  });
  const phone3 = new PhoneNumber({
    identityId: "identityId",
    phoneNumber: "phoneNumber3",
    primary: false,
    verified: false,
    updated: new Date("2021-01-03T08:00:00.000Z"),
  });
  const phone4 = new PhoneNumber({
    identityId: "identityId",
    phoneNumber: "phoneNumber4",
    primary: false,
    verified: false,
    updated: new Date("2021-01-04T08:00:00.000Z"),
  });
  const phone5 = new PhoneNumber({
    identityId: "identityId",
    phoneNumber: "phoneNumber5",
    primary: false,
    verified: false,
    updated: new Date("2021-01-05T08:00:00.000Z"),
  });

  let ctx: any;

  beforeEach(() => {
    ctx = {
      logger,
      repository: {
        phoneNumberRepository: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      },
    };
  });

  test("should base result on primary", async () => {
    ctx.repository.phoneNumberRepository.findMany.mockResolvedValue([phone1, phone2, phone3]);

    await expect(userinfoPhoneNumberGet(ctx, "identityId")).resolves.toStrictEqual({
      phoneNumber: "phoneNumber1",
      phoneNumberVerified: true,
    });
  });

  test("should base result on verified", async () => {
    ctx.repository.phoneNumberRepository.findMany.mockResolvedValue([phone2, phone3]);

    await expect(userinfoPhoneNumberGet(ctx, "identityId")).resolves.toStrictEqual({
      phoneNumber: "phoneNumber2",
      phoneNumberVerified: true,
    });
  });

  test("should base result on updated", async () => {
    ctx.repository.phoneNumberRepository.findMany.mockResolvedValue([phone3, phone4, phone5]);

    await expect(userinfoPhoneNumberGet(ctx, "identityId")).resolves.toStrictEqual({
      phoneNumber: "phoneNumber5",
      phoneNumberVerified: false,
    });
  });

  test("should resolve the only available phone number", async () => {
    ctx.repository.phoneNumberRepository.findMany.mockResolvedValue([phone3]);

    await expect(userinfoPhoneNumberGet(ctx, "identityId")).resolves.toStrictEqual({
      phoneNumber: "phoneNumber3",
      phoneNumberVerified: false,
    });
  });

  test("should resolve an empty result when no phone numbers can be found", async () => {
    ctx.repository.phoneNumberRepository.findMany.mockResolvedValue([]);

    await expect(userinfoPhoneNumberGet(ctx, "identityId")).resolves.toStrictEqual({
      phoneNumber: null,
      phoneNumberVerified: false,
    });
  });

  test("should resolve an empty result when an error is thrown", async () => {
    ctx.repository.phoneNumberRepository.findMany.mockRejectedValue(new Error("message"));

    await expect(userinfoPhoneNumberGet(ctx, "identityId")).resolves.toStrictEqual({
      phoneNumber: null,
      phoneNumberVerified: false,
    });
  });
});
