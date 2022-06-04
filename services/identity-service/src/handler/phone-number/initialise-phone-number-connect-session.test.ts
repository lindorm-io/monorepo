import MockDate from "mockdate";
import { ClientError } from "@lindorm-io/errors";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { PhoneNumber } from "../../entity";
import { createMockLogger } from "@lindorm-io/winston";
import { getTestIdentity } from "../../test/entity";
import { initialiseConnectSession as _initialiseConnectSession } from "../connect-session";
import { initialisePhoneNumberConnectSession } from "./initialise-phone-number-connect-session";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../connect-session");

const initialiseConnectSession = _initialiseConnectSession as jest.Mock;

describe("initialisePhoneNumberConnectSession", () => {
  const phoneNumber1 = new PhoneNumber({
    id: "206a2773-4b19-4bbf-bd01-5a53657a5298",
    identityId: "identityId",
    phoneNumber: "phoneNumber1",
    primary: false,
    verified: false,
  });

  let ctx: any;
  let identity: any;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
      repository: {
        phoneNumberRepository: {
          find: jest.fn().mockResolvedValue(phoneNumber1),
          create: jest.fn().mockImplementation(async (entity: any) => entity),
        },
      },
    };

    identity = getTestIdentity();

    initialiseConnectSession.mockResolvedValue("connect-session");
  });

  test("should initialise connection for existing phoneNumber", async () => {
    await expect(
      initialisePhoneNumberConnectSession(ctx, identity, "phoneNumber"),
    ).resolves.toStrictEqual("connect-session");
  });

  test("should initialise connection for new phoneNumber", async () => {
    ctx.repository.phoneNumberRepository.find.mockRejectedValue(new EntityNotFoundError("message"));

    await expect(
      initialisePhoneNumberConnectSession(ctx, identity, "phoneNumber"),
    ).resolves.toStrictEqual("connect-session");
  });

  test("should throw if phoneNumber is already verified", async () => {
    phoneNumber1.verified = true;

    await expect(initialisePhoneNumberConnectSession(ctx, identity, "phoneNumber")).rejects.toThrow(
      ClientError,
    );
  });
});
