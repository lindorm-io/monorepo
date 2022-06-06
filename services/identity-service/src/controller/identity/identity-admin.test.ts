import MockDate from "mockdate";
import { createMockLogger } from "@lindorm-io/winston";
import { createTestIdentity } from "../../fixtures/entity";
import { identityAdminController } from "./identity-admin";
import { createMockRepository } from "@lindorm-io/mongo";

MockDate.set("2020-01-01T08:00:00.000");

describe("identityAdminController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        active: true,
        permissions: ["one", "two"],
      },
      entity: {
        identity: createTestIdentity({
          id: "identityId",
          active: false,
          permissions: [],
          nationalIdentityNumber: "480796381535",
          socialSecurityNumber: "200661435114",
          username: "li61qVCuw8eMH6xq",
        }),
      },
      logger: createMockLogger(),
      repository: {
        identityRepository: createMockRepository(createTestIdentity),
      },
    };
  });

  test("should update identity", async () => {
    await expect(identityAdminController(ctx)).resolves.toBeUndefined();

    expect(ctx.repository.identityRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        active: true,
        permissions: ["one", "two"],
      }),
    );
  });
});
