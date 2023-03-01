import { createTestAccount, createTestAuthenticationSession } from "../../fixtures/entity";
import { getValidDeviceLinks as _getValidDeviceLinks } from "./get-valid-device-links";
import { getValidIdentitySessions as _getValidIdentitySessions } from "./get-valid-identity-sessions";
import { resolveAllowedStrategies } from "./resolve-allowed-strategies";
import { createMockLogger } from "@lindorm-io/winston";

jest.mock("./get-valid-device-links");
jest.mock("./get-valid-identity-sessions");

const getValidDeviceLinks = _getValidDeviceLinks as jest.Mock;
const getValidIdentitySessions = _getValidIdentitySessions as jest.Mock;

describe("resolveAllowedMethods", () => {
  let ctx: any;
  let authenticationSession: any;
  let account: any;

  beforeEach(() => {
    ctx = {
      cookies: {
        get: jest.fn().mockImplementation(() => true),
      },
      logger: createMockLogger(),
    };

    authenticationSession = createTestAuthenticationSession();
    account = createTestAccount();

    getValidDeviceLinks.mockResolvedValue(["5551d402-26c5-44d5-92ae-2f534f4c1568"]);
    getValidIdentitySessions.mockResolvedValue([
      "d9d5024b-6776-4c3b-bf86-079912a7d492",
      "187dcf63-f434-4151-a72f-d84a337806f8",
    ]);
  });

  test("should resolve", async () => {
    await expect(
      resolveAllowedStrategies(ctx, authenticationSession, account),
    ).resolves.toStrictEqual([
      "device_challenge",
      "email_code",
      "email_otp",
      "password_browser_link",
      "session_accept_with_code",
    ]);
  });
});
