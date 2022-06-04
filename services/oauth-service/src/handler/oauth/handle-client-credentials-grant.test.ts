import { ClientError } from "@lindorm-io/errors";
import { createClientCredentialsToken as _createClientCredentialsToken } from "../token";
import { getTestClient } from "../../test/entity";
import { handleClientCredentialsGrant } from "./handle-client-credentials-grant";

jest.mock("../token");

const createClientCredentialsToken = _createClientCredentialsToken as jest.Mock;

describe("handleAuthorizationCodeGrant", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        scope: "address email offline_access openid phone profile",
      },
      entity: {
        client: getTestClient({
          id: "08bac8f5-af23-43a9-bb43-cda6cc2ec2c6",
        }),
      },
    };

    createClientCredentialsToken.mockImplementation(() => ({
      token: "jwt.jwt.jwt",
      expiresIn: 999,
    }));
  });

  test("should resolve", async () => {
    await expect(handleClientCredentialsGrant(ctx)).resolves.toMatchSnapshot();
  });

  test("should throw on invalid client", async () => {
    ctx.entity.client.active = false;

    await expect(handleClientCredentialsGrant(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on invalid scope", async () => {
    ctx.data.scope = "wrong";

    await expect(handleClientCredentialsGrant(ctx)).rejects.toThrow(ClientError);
  });
});
