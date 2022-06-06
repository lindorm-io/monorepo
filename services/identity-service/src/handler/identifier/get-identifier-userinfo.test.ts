import { Identity } from "../../entity";
import { createMockRepository } from "@lindorm-io/mongo";
import {
  createTestEmailIdentifier,
  createTestExternalIdentifier,
  createTestIdentity,
  createTestPhoneIdentifier,
} from "../../fixtures/entity";
import { createMockLogger } from "@lindorm-io/winston";
import { getIdentifierUserinfo } from "./get-identifier-userinfo";

describe("getIdentifierUserinfo", () => {
  let ctx: any;
  let identity: Identity;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
      repository: {
        identifierRepository: createMockRepository(createTestEmailIdentifier),
      },
    };

    identity = createTestIdentity();
  });

  test("should resolve", async () => {
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

    await expect(getIdentifierUserinfo(ctx, identity)).resolves.toMatchSnapshot();
  });

  test("should resolve data on empty array", async () => {
    ctx.repository.identifierRepository.findMany.mockResolvedValue([]);

    await expect(getIdentifierUserinfo(ctx, identity)).resolves.toMatchSnapshot();
  });

  test("should resolve data on caught error", async () => {
    ctx.repository.identifierRepository.findMany.mockRejectedValue(new Error("message"));

    await expect(getIdentifierUserinfo(ctx, identity)).resolves.toMatchSnapshot();
  });
});
