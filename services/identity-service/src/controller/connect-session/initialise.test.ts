import { ClientError } from "@lindorm-io/errors";
import { IdentifierType } from "../../common";
import { createMockLogger } from "@lindorm-io/winston";
import { createTestConnectSession, createTestIdentity } from "../../fixtures/entity";
import { identifierConnectInitialiseController } from "./initialise";
import {
  initialiseEmailConnectSession as _initialiseEmailConnectSession,
  initialisePhoneNumberConnectSession as _initialisePhoneNumberConnectSession,
} from "../../handler";

jest.mock("../../handler");

const initialiseEmailConnectSession = _initialiseEmailConnectSession as jest.Mock;
const initialisePhoneNumberConnectSession = _initialisePhoneNumberConnectSession as jest.Mock;

describe("identifierConnectInitialiseController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        id: "identityId",
        identifier: "email",
        type: "type",
      },
      entity: {
        identity: createTestIdentity({ id: "identityId" }),
      },
      logger: createMockLogger(),
    };

    initialiseEmailConnectSession.mockResolvedValue(
      createTestConnectSession({
        id: "4b55a038-3615-444f-9221-d9086b564427",
      }),
    );
    initialisePhoneNumberConnectSession.mockResolvedValue(
      createTestConnectSession({
        id: "86f78995-6511-4fab-b9e4-574e2f2e3c13",
      }),
    );
  });

  test("should resolve for EMAIL", async () => {
    ctx.data.type = IdentifierType.EMAIL;

    await expect(identifierConnectInitialiseController(ctx)).resolves.toStrictEqual({
      body: {
        sessionId: "4b55a038-3615-444f-9221-d9086b564427",
      },
    });

    expect(initialiseEmailConnectSession).toHaveBeenCalled();
  });

  test("should resolve for PHONE_NUMBER", async () => {
    ctx.data.type = IdentifierType.PHONE;

    await expect(identifierConnectInitialiseController(ctx)).resolves.toStrictEqual({
      body: {
        sessionId: "86f78995-6511-4fab-b9e4-574e2f2e3c13",
      },
    });

    expect(initialisePhoneNumberConnectSession).toHaveBeenCalled();
  });

  test("should throw on unexpected type", async () => {
    await expect(identifierConnectInitialiseController(ctx)).rejects.toThrow(ClientError);
  });
});
