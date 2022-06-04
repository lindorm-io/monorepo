import MockDate from "mockdate";
import { ClientError } from "@lindorm-io/errors";
import { Email } from "../../entity";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { createMockLogger } from "@lindorm-io/winston";
import { getTestIdentity } from "../../test/entity";
import { initialiseConnectSession as _initialiseConnectSession } from "../connect-session";
import { initialiseEmailConnectSession } from "./initialise-email-connect-session";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../connect-session");

const initialiseConnectSession = _initialiseConnectSession as jest.Mock;

describe("initialiseEmailConnectSession", () => {
  const email1 = new Email({
    id: "206a2773-4b19-4bbf-bd01-5a53657a5298",
    identityId: "identityId",
    email: "email1",
    primary: false,
    verified: false,
  });

  let ctx: any;
  let identity: any;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
      repository: {
        emailRepository: {
          find: jest.fn().mockResolvedValue(email1),
          create: jest.fn().mockImplementation(async (entity: any) => entity),
        },
      },
    };

    identity = getTestIdentity();

    initialiseConnectSession.mockResolvedValue("connect-session");
  });

  test("should initialise connection for existing email", async () => {
    await expect(initialiseEmailConnectSession(ctx, identity, "email")).resolves.toStrictEqual(
      "connect-session",
    );
  });

  test("should initialise connection for new email", async () => {
    ctx.repository.emailRepository.find.mockRejectedValue(new EntityNotFoundError("message"));

    await expect(initialiseEmailConnectSession(ctx, identity, "email")).resolves.toStrictEqual(
      "connect-session",
    );
  });

  test("should throw if email is already verified", async () => {
    email1.verified = true;

    await expect(initialiseEmailConnectSession(ctx, identity, "email")).rejects.toThrow(
      ClientError,
    );
  });
});
