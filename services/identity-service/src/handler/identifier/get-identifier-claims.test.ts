import { Identity } from "../../entity";
import { createMockLogger } from "@lindorm-io/winston";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import { getIdentifierClaims } from "./get-identifier-claims";
import {
  createTestEmailIdentifier,
  createTestExternalIdentifier,
  createTestIdentity,
  createTestNinIdentifier,
  createTestPhoneIdentifier,
  createTestSsnIdentifier,
} from "../../fixtures/entity";

describe("getIdentifierClaims", () => {
  let ctx: any;
  let identity: Identity;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
      mongo: {
        identifierRepository: createMockMongoRepository(createTestEmailIdentifier),
      },
    };

    identity = createTestIdentity();
  });

  test("should resolve", async () => {
    ctx.mongo.identifierRepository.findMany.mockResolvedValue([
      createTestEmailIdentifier({
        value: "one@lindorm.io",
        primary: false,
      }),
      createTestEmailIdentifier({
        value: "two@lindorm.io",
        primary: true,
      }),
      createTestEmailIdentifier({
        value: "three@lindorm.io",
        primary: false,
      }),
      createTestPhoneIdentifier({
        value: "+46701000001",
        primary: false,
        verified: false,
      }),
      createTestPhoneIdentifier({
        value: "+46701000002",
        primary: true,
        verified: false,
      }),
      createTestNinIdentifier({
        value: "198012129988",
        primary: true,
        verified: true,
      }),
      createTestSsnIdentifier({
        value: "847602817432",
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

    await expect(getIdentifierClaims(ctx, identity)).resolves.toStrictEqual({
      email: "two@lindorm.io",
      emailVerified: true,
      nationalIdentityNumber: "198012129988",
      nationalIdentityNumberVerified: true,
      phoneNumber: "+46701000002",
      phoneNumberVerified: false,
      socialSecurityNumber: "847602817432",
      socialSecurityNumberVerified: false,
    });
  });

  test("should resolve data on empty array", async () => {
    ctx.mongo.identifierRepository.findMany.mockResolvedValue([]);

    await expect(getIdentifierClaims(ctx, identity)).resolves.toStrictEqual({
      email: null,
      emailVerified: false,
      nationalIdentityNumber: null,
      nationalIdentityNumberVerified: false,
      phoneNumber: null,
      phoneNumberVerified: false,
      socialSecurityNumber: null,
      socialSecurityNumberVerified: false,
    });
  });

  test("should resolve data on caught error", async () => {
    ctx.mongo.identifierRepository.findMany.mockRejectedValue(new Error("message"));

    await expect(getIdentifierClaims(ctx, identity)).resolves.toStrictEqual({
      email: null,
      emailVerified: false,
      nationalIdentityNumber: null,
      nationalIdentityNumberVerified: false,
      phoneNumber: null,
      phoneNumberVerified: false,
      socialSecurityNumber: null,
      socialSecurityNumberVerified: false,
    });
  });
});
