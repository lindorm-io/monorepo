import MockDate from "mockdate";
import { getAuthenticationInfoController } from "./get-authentication-info";
import { isAuthenticationRequired as _isAuthenticationRequired } from "../../util";
import {
  createTestAuthorizationSession,
  createTestBrowserSession,
  createTestClient,
} from "../../fixtures/entity";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../util");

const isAuthenticationRequired = _isAuthenticationRequired as jest.Mock;

describe("getAuthenticationInfoController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        authorizationSession: createTestAuthorizationSession({
          id: "896f2d7b-2205-42b4-b1c6-ec2ac2d22895",
          identityId: "3f6ee784-bf36-4570-b15e-883dad02ec56",
        }),
        browserSession: createTestBrowserSession({
          id: "baa9910c-06e0-4d8b-a46d-870d8aa90218",
          identityId: "3f6ee784-bf36-4570-b15e-883dad02ec56",
        }),
        client: createTestClient({
          id: "a8fbad57-e43a-4e05-b4c8-7607348bd5b7",
        }),
      },
    };

    isAuthenticationRequired.mockImplementation(() => true);
  });

  test("should resolve", async () => {
    await expect(getAuthenticationInfoController(ctx)).resolves.toMatchSnapshot();
  });
});
