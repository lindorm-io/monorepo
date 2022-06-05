import { Account } from "../../entity";
import { deviceLinkGetIdentityDeviceLinks as _deviceLinkGetIdentityDeviceLinks } from "../axios";
import { createTestAccount } from "../../fixtures/entity";
import { getValidIdentityDeviceLinks } from "./get-valid-identity-device-links";

jest.mock("../axios");

const deviceLinkGetIdentityDeviceLinks = _deviceLinkGetIdentityDeviceLinks as jest.Mock;

describe("getValidIdentityDeviceLinks", () => {
  let ctx: any;
  let account: Account;

  beforeEach(() => {
    ctx = {};

    account = createTestAccount();

    deviceLinkGetIdentityDeviceLinks.mockResolvedValue({
      deviceLinks: ["7873e4ba-318c-4889-ab32-eb8297094aa1", "a63b4c2c-7e6b-490d-998c-8d471143d631"],
    });
  });

  test("should resolve", async () => {
    await expect(getValidIdentityDeviceLinks(ctx, account)).resolves.toStrictEqual([
      "7873e4ba-318c-4889-ab32-eb8297094aa1",
      "a63b4c2c-7e6b-490d-998c-8d471143d631",
    ]);
  });

  test("should resolve empty array when account is missing", async () => {
    await expect(getValidIdentityDeviceLinks(ctx)).resolves.toStrictEqual([]);
  });

  test("should resolve empty array when identity service fails", async () => {
    deviceLinkGetIdentityDeviceLinks.mockRejectedValue(new Error("message"));

    await expect(getValidIdentityDeviceLinks(ctx)).resolves.toStrictEqual([]);
  });
});
