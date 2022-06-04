import { ClientError } from "@lindorm-io/errors";
import { IdentifierType } from "../../common";
import { authenticateIdentifierController } from "./authenticate";
import { createMockLogger } from "@lindorm-io/winston";

jest.mock("../../handler", () => ({
  verifyEmail: jest.fn().mockResolvedValue({ id: "email", disabled: false }),
  verifyExternalIdentifier: jest.fn().mockResolvedValue({ id: "oidc", disabled: false }),
  verifyPhoneNumber: jest.fn().mockResolvedValue({ id: "phone", disabled: false }),
}));

describe("authenticateIdentifierController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        identifier: "identifier",
        provider: "https://provider.url/",
        type: "type",
      },
      logger: createMockLogger(),
      repository: {
        identityRepository: {
          find: jest.fn().mockResolvedValue({ id: "username", disabled: false }),
        },
      },
    };
  });

  test("should resolve for EMAIL", async () => {
    ctx.data.identifier = "test@email.com";
    ctx.data.type = IdentifierType.EMAIL;

    await expect(authenticateIdentifierController(ctx)).resolves.toStrictEqual({
      body: {
        identityId: "email",
      },
    });
  });

  test("should resolve for PHONE", async () => {
    ctx.data.identifier = "+46700112233";
    ctx.data.type = IdentifierType.PHONE;

    await expect(authenticateIdentifierController(ctx)).resolves.toStrictEqual({
      body: {
        identityId: "phone",
      },
    });
  });

  test("should resolve for EXTERNAL", async () => {
    ctx.data.identifier = "external";
    ctx.data.type = IdentifierType.EXTERNAL;

    await expect(authenticateIdentifierController(ctx)).resolves.toStrictEqual({
      body: {
        identityId: "oidc",
      },
    });
  });

  test("should resolve for USERNAME", async () => {
    ctx.data.identifier = "username";
    ctx.data.type = IdentifierType.USERNAME;

    await expect(authenticateIdentifierController(ctx)).resolves.toStrictEqual({
      body: {
        identityId: "username",
      },
    });
  });

  test("should throw on unexpected type", async () => {
    await expect(authenticateIdentifierController(ctx)).rejects.toThrow(ClientError);
  });
});
