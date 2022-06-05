import { Account, LoginSession } from "../../entity";
import { calculateAllowedFlows as _calculateAllowedFlows } from "./calculate-allowed-flows";
import { createTestAccount, createTestLoginSession } from "../../fixtures/entity";
import { getValidIdentityDeviceLinks as _getValidIdentityDeviceLinks } from "./get-valid-identity-device-links";
import { getValidIdentitySessions as _getValidIdentitySessions } from "./get-valid-identity-sessions";
import { resolveAllowedFlows } from "./resolve-allowed-flows";

jest.mock("./calculate-allowed-flows");
jest.mock("./get-valid-identity-device-links");
jest.mock("./get-valid-identity-sessions");

const calculateAllowedFlows = _calculateAllowedFlows as jest.Mock;
const getValidIdentityDeviceLinks = _getValidIdentityDeviceLinks as jest.Mock;
const getValidIdentitySessions = _getValidIdentitySessions as jest.Mock;

describe("resolveAllowedFlows", () => {
  let ctx: any;
  let account: Account;
  let loginSession: LoginSession;

  beforeEach(() => {
    ctx = {};

    account = createTestAccount();

    loginSession = createTestLoginSession({
      deviceLinks: [],
      sessions: [],
    });

    calculateAllowedFlows.mockImplementation(() => ["allowed"]);
    getValidIdentityDeviceLinks.mockResolvedValue(["device"]);
    getValidIdentitySessions.mockResolvedValue(["session"]);
  });

  test("should resolve", async () => {
    await expect(resolveAllowedFlows(ctx, loginSession, account)).resolves.toStrictEqual(
      expect.objectContaining({
        allowedFlows: ["allowed"],
        deviceLinks: ["device"],
        sessions: ["session"],
      }),
    );
  });
});
