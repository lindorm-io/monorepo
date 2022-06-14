import { AuthenticationMethod } from "../../enum";
import { createTestAuthenticationSession } from "../../fixtures/entity";
import { handleAuthenticationInitialisation as _handleAuthenticationInitialisation } from "../../handler";
import { initialiseAuthenticationController } from "./initialise-authentication";

jest.mock("../../handler");

const handleAuthenticationInitialisation = _handleAuthenticationInitialisation as jest.Mock;

describe("initialiseAuthenticationController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        clientId: "5a30f38c-bfcb-4bd3-a76f-6fdce87e7a82",
        country: "se",
        identityId: "71781faf-5195-4cd9-8200-5a54b9ddcdc6",
        levelOfAssurance: 4,
        methods: [AuthenticationMethod.EMAIL_LINK],
        nonce: "nonce",
        codeChallenge: "codeChallenge",
        codeMethod: "codeMethod",
      },
    };

    handleAuthenticationInitialisation.mockResolvedValue(
      createTestAuthenticationSession({
        id: "f6988ae2-8b88-4ccf-adfb-5234f10621a6",
      }),
    );
  });

  test("should resolve", async () => {
    await expect(initialiseAuthenticationController(ctx)).resolves.toStrictEqual({
      body: {
        id: "f6988ae2-8b88-4ccf-adfb-5234f10621a6",
      },
    });
  });
});
