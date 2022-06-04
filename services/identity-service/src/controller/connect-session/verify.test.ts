import { ClientError } from "@lindorm-io/errors";
import { IdentifierType } from "../../common";
import { createMockLogger } from "@lindorm-io/winston";
import { identifierConnectVerifyController } from "./verify";
import {
  verifyEmailConnectSession as _verifyEmailConnectSession,
  verifyPhoneNumberConnectSession as _verifyPhoneNumberConnectSession,
} from "../../handler";

jest.mock("../../handler");

const verifyEmailConnectSession = _verifyEmailConnectSession as jest.Mock;
const verifyPhoneNumberConnectSession = _verifyPhoneNumberConnectSession as jest.Mock;

describe("identifierConnectVerifyController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        code: "code",
      },
      entity: {
        connectSession: { type: "type" },
      },
      logger: createMockLogger(),
    };
  });

  test("should resolve for EMAIL", async () => {
    ctx.entity.connectSession.type = IdentifierType.EMAIL;

    await expect(identifierConnectVerifyController(ctx)).resolves.toBeUndefined();

    expect(verifyEmailConnectSession).toHaveBeenCalled();
  });

  test("should resolve for PHONE_NUMBER", async () => {
    ctx.entity.connectSession.type = IdentifierType.PHONE;

    await expect(identifierConnectVerifyController(ctx)).resolves.toBeUndefined();

    expect(verifyPhoneNumberConnectSession).toHaveBeenCalled();
  });

  test("should throw on unexpected type", async () => {
    await expect(identifierConnectVerifyController(ctx)).rejects.toThrow(ClientError);
  });
});
