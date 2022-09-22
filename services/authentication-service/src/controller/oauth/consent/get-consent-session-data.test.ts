import { getConsentSessionDataController } from "./get-consent-session-data";
import { fetchOauthConsentData as _fetchOauthConsentInfo } from "../../../handler";

jest.mock("../../../handler");

const fetchOauthConsentInfo = _fetchOauthConsentInfo as jest.Mock;

describe("getConsentSessionDataController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: { id: "id" },
    };

    fetchOauthConsentInfo.mockResolvedValue({
      consentStatus: "consentStatus",
      client: {
        name: "name",
        description: "description",
        logoUri: "logoUri",
        requiredScopes: ["requiredScopes"],
        scopeDescriptions: ["scopeDescriptions"],
        type: "type",
      },
      requested: {
        audiences: ["audience"],
        scopes: ["scope"],
      },
    });
  });

  test("should resolve", async () => {
    await expect(getConsentSessionDataController(ctx)).resolves.toStrictEqual({
      body: {
        client: {
          description: "description",
          logoUri: "logoUri",
          name: "name",
          requiredScopes: ["requiredScopes"],
          scopeDescriptions: ["scopeDescriptions"],
          type: "type",
        },
        requested: {
          audiences: ["audience"],
          scopes: ["scope"],
        },
        status: "consentStatus",
      },
    });
  });
});
