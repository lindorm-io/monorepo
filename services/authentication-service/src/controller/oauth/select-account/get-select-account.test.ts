import { OpenIdClientType, SessionStatus } from "@lindorm-io/common-enums";
import { mockFetchIdentity, mockFetchOauthAuthorizationSession } from "../../../fixtures/axios";
import {
  getIdentity as _getIdentity,
  getOauthAuthorizationSession as _getOauthAuthorizationSession,
} from "../../../handler";
import { getSelectAccountController } from "./get-select-account";

jest.mock("../../../handler");

const getOauthAuthorizationSession = _getOauthAuthorizationSession as jest.Mock;
const getIdentity = _getIdentity as jest.Mock;

describe("getSelectAccountController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: { id: "c1fa4fa8-f235-48bd-a514-427536a62f25" },
    };

    getOauthAuthorizationSession.mockResolvedValue(
      mockFetchOauthAuthorizationSession({
        selectAccount: {
          isRequired: true,
          status: SessionStatus.PENDING,
          sessions: [
            {
              identityId: "c1fa4fa8-f235-48bd-a514-427536a62f25",
              selectId: "9e3a5f78-f237-45ea-8b5a-afc3ed719166",
            },
            {
              identityId: "6d405979-ebbf-4d21-925b-338f5e552912",
              selectId: "d7c1faa1-3117-4d34-adf9-215c468dff9b",
            },
          ],
        },

        client: {
          id: "57bbab21-96ba-407c-94ae-58229cac0e37",
          logoUri: "https://test.client.com/logo.png",
          name: "Test Client",
          type: OpenIdClientType.PUBLIC,
          singleSignOn: true,
        },

        tenant: {
          id: "9ee07526-34a2-4bd1-981c-94fb91d35fd3",
          name: "Test Tenant",
        },
      }),
    );

    getIdentity
      .mockResolvedValueOnce(mockFetchIdentity({ name: "One" }))
      .mockResolvedValueOnce(mockFetchIdentity({ name: "Two" }));
  });

  test("should resolve", async () => {
    await expect(getSelectAccountController(ctx)).resolves.toStrictEqual({
      body: {
        status: "pending",

        client: {
          id: "57bbab21-96ba-407c-94ae-58229cac0e37",
          logoUri: "https://test.client.com/logo.png",
          name: "Test Client",
          singleSignOn: true,
          type: "public",
        },

        tenant: {
          id: "9ee07526-34a2-4bd1-981c-94fb91d35fd3",
          name: "Test Tenant",
        },

        sessions: [
          {
            active: true,
            avatarUri: "https://avatar.url/",
            identityId: "c1fa4fa8-f235-48bd-a514-427536a62f25",
            name: "One",
            picture: "https://picture.url/",
            selectId: "9e3a5f78-f237-45ea-8b5a-afc3ed719166",
          },
          {
            active: true,
            avatarUri: "https://avatar.url/",
            identityId: "6d405979-ebbf-4d21-925b-338f5e552912",
            name: "Two",
            picture: "https://picture.url/",
            selectId: "d7c1faa1-3117-4d34-adf9-215c468dff9b",
          },
        ],
      },
    });
  });
});
