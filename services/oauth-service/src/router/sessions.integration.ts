import MockDate from "mockdate";
import request from "supertest";
import { server } from "../server/server";
import { createTestBrowserSession } from "../fixtures/entity";
import {
  TEST_BROWSER_SESSION_REPOSITORY,
  getTestAccessToken,
  getTestAuthenticationConfirmationToken,
  setupIntegration,
} from "../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/sessions", () => {
  beforeAll(setupIntegration);

  test("PUT /authenticate", async () => {
    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(createTestBrowserSession());

    const authToken = getTestAuthenticationConfirmationToken({
      subject: browserSession.identityId,
    });

    const accessToken = getTestAccessToken({
      sessionId: browserSession.id,
      subject: browserSession.identityId,
    });

    await request(server.callback())
      .put("/sessions/authenticate")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        auth_token: authToken,
      })
      .expect(204);

    await expect(
      TEST_BROWSER_SESSION_REPOSITORY.find({ id: browserSession.id }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        acrValues: ["loa_3"],
        amrValues: ["email_otp", "phone_otp", "device_challenge"],
        latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        levelOfAssurance: 3,
      }),
    );
  });
});
