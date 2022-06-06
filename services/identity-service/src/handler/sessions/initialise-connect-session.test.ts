import { Identifier } from "../../entity";
import { ServerError } from "@lindorm-io/errors";
import { createMockCache } from "@lindorm-io/redis";
import { createTestConnectSession, createTestPhoneIdentifier } from "../../fixtures/entity";
import { initialiseConnectSession } from "./initialise-connect-session";
import { isIdentifierStoredSeparately as _isIdentifierStoredSeparately } from "../../util";

jest.mock("../../instance", () => ({
  argon: {
    encrypt: jest.fn().mockImplementation(async (input) => `encrypted-${input}`),
  },
}));
jest.mock("../../util");

const isIdentifierStoredSeparately = _isIdentifierStoredSeparately as jest.Mock;

describe("initialiseConnectSession", () => {
  let ctx: any;
  let identifier: Identifier;

  beforeEach(() => {
    ctx = {
      cache: {
        connectSessionCache: createMockCache(createTestConnectSession),
      },
    };

    identifier = createTestPhoneIdentifier();

    isIdentifierStoredSeparately.mockImplementation(() => true);
  });

  test("should resolve", async () => {
    await expect(initialiseConnectSession(ctx, identifier, "code")).resolves.toStrictEqual(
      expect.objectContaining({
        code: "encrypted-code",
        identifierId: identifier.id,
      }),
    );
  });

  test("should reject", async () => {
    isIdentifierStoredSeparately.mockImplementation(() => false);

    await expect(initialiseConnectSession(ctx, identifier, "code")).rejects.toThrow(ServerError);
  });
});
