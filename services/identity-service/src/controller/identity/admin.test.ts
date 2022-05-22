import MockDate from "mockdate";
import { getTestIdentity } from "../../test/entity";
import { identityAdminController } from "./admin";
import { logger } from "../../test/logger";

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
        identity: getTestIdentity({
          id: "identityId",
          active: false,
          permissions: [],
          nationalIdentityNumber: "480796381535",
          socialSecurityNumber: "200661435114",
          username: "li61qVCuw8eMH6xq",
        }),
      },
      logger,
      repository: {
        identityRepository: {
          update: jest.fn(),
        },
      },
    };
  });

  test("should update identity", async () => {
    await expect(identityAdminController(ctx)).resolves.toStrictEqual({
      body: {},
    });

    expect(ctx.repository.identityRepository.update.mock.calls).toMatchSnapshot();
  });
});
