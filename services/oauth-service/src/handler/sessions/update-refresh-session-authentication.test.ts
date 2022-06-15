import MockDate from "mockdate";
import { createMockLogger } from "@lindorm-io/winston";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestRefreshSession } from "../../fixtures/entity";
import { getUnixTime } from "date-fns";
import { updateRefreshSessionAuthentication } from "./update-refresh-session-authentication";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("updateRefreshSessionAuthentication", () => {
  let ctx: any;
  let token: any;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
      repository: {
        refreshSessionRepository: createMockRepository(createTestRefreshSession),
      },
    };

    token = {
      authContextClass: ["loa_3"],
      authMethodsReference: ["device_challenge"],
      authTime: getUnixTime(new Date("2021-01-01T08:00:00.000Z")),
      levelOfAssurance: 3,
    };
  });

  test("should resolve", async () => {
    await expect(
      updateRefreshSessionAuthentication(ctx, "sessionId", token),
    ).resolves.toBeUndefined();

    expect(ctx.repository.refreshSessionRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        acrValues: ["loa_3"],
        amrValues: ["email_otp", "phone_otp", "device_challenge"],
        latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        levelOfAssurance: 3,
      }),
    );
  });
});
