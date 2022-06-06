import { ClientError } from "@lindorm-io/errors";
import { Scope } from "../../common";
import { createMockRepository } from "@lindorm-io/mongo";
import { getIdentityController } from "./get-identity";
import {
  createTestEmailIdentifier,
  createTestExternalIdentifier,
  createTestIdentity,
  createTestPhoneIdentifier,
} from "../../fixtures/entity";

describe("getIdentityController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        identity: createTestIdentity({
          nationalIdentityNumber: "368366220087",
          socialSecurityNumber: "587690345469",
          username: "GHGB2KHAv8vRCd4N",
        }),
      },
      repository: {
        identifierRepository: createMockRepository(createTestEmailIdentifier),
      },
      token: {
        bearerToken: {
          scopes: [Scope.OPENID],
        },
      },
    };
  });

  test("should resolve openid", async () => {
    await expect(getIdentityController(ctx)).resolves.toMatchSnapshot();
  });

  test("should resolve all", async () => {
    ctx.token.bearerToken.scopes = Object.values(Scope);

    ctx.repository.identifierRepository.findMany.mockResolvedValue([
      createTestEmailIdentifier({
        identifier: "one@lindorm.io",
        primary: false,
      }),
      createTestEmailIdentifier({
        identifier: "two@lindorm.io",
        primary: true,
      }),
      createTestEmailIdentifier({
        identifier: "three@lindorm.io",
        primary: false,
      }),
      createTestPhoneIdentifier({
        identifier: "+46701000001",
        primary: false,
        verified: false,
      }),
      createTestPhoneIdentifier({
        identifier: "+46701000002",
        primary: true,
        verified: false,
      }),
      createTestExternalIdentifier({
        provider: "https://one.com",
      }),
      createTestExternalIdentifier({
        provider: "https://two.com",
      }),
    ]);

    await expect(getIdentityController(ctx)).resolves.toMatchSnapshot();
  });

  test("should throw on invalid scope", async () => {
    ctx.token.bearerToken.scopes = [];

    await expect(getIdentityController(ctx)).rejects.toThrow(ClientError);
  });
});
