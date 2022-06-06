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
        id: "28d53d56-c26e-4c80-bfe6-2f0ca15f9ed5",
        identifier: "one@lindorm.io",
        primary: false,
      }),
      createTestEmailIdentifier({
        id: "b843a4db-8098-47bb-9cdb-76eee2fbb037",
        identifier: "two@lindorm.io",
        primary: true,
      }),
      createTestEmailIdentifier({
        id: "6a168fdc-4581-4f34-8a49-c9896cb2d577",
        identifier: "three@lindorm.io",
        primary: false,
      }),
      createTestPhoneIdentifier({
        id: "2f9027ab-041c-4485-aded-46654feaa5e2",
        identifier: "+46701000001",
        primary: false,
        verified: false,
      }),
      createTestPhoneIdentifier({
        id: "f505d41b-2913-437b-bfcf-b76003328aad",
        identifier: "+46701000002",
        primary: true,
        verified: false,
      }),
      createTestExternalIdentifier({
        id: "6f50eb8e-b958-4fb0-9940-0d87adfc92ad",
        provider: "https://one.com",
      }),
      createTestExternalIdentifier({
        id: "ede78e6e-d8a2-4524-87fe-cc2b8f25004c",
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
