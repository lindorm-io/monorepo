import MockDate from "mockdate";
import request from "supertest";
import { getTestAccessToken, setupIntegration } from "../fixtures/integration";
import { server } from "../server/server";
import { randomUUID } from "crypto";
import { createURL } from "@lindorm-io/url";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/connect", () => {
  beforeAll(setupIntegration);

  test("GET /", async () => {
    const accessToken = await getTestAccessToken({
      subject: "d821cde6-250f-4918-ad55-877a7abf0271",
    });

    const url = createURL("https://test.test/connect", {
      query: {
        callbackId: randomUUID(),
        callbackUri: "https://test.lindorm.io/callback",
        provider: "microsoft",
      },
    })
      .toString()
      .replace("https://test.test", "");

    const response = await request(server.callback())
      .get(url)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(302);

    const location = new URL(response.headers.location);

    expect(location.origin).toBe("https://microsoft.com");
    expect(location.pathname).toBe("/authorize");
    expect(location.searchParams.get("client_id")).toBe("microsoft_client_id");
    expect(location.searchParams.get("redirect_uri")).toBe("https://oidc.test.lindorm.io/callback");
    expect(location.searchParams.get("response_mode")).toBe("query");
    expect(location.searchParams.get("response_type")).toBe("token");
    expect(location.searchParams.get("scope")).toBe("openid profile");
  });
});
