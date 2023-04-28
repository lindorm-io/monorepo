import { createTestAuthenticationSession } from "../fixtures/entity";
import { AuthenticationSession } from "../entity";
import { getConfigHint } from "./get-config-hint";

describe("getConfigHint", () => {
  let authenticationSession: AuthenticationSession;
  let config: any;

  beforeEach(() => {
    authenticationSession = createTestAuthenticationSession();
    config = {};
  });

  test("should resolve email", () => {
    config.hintType = "email";

    expect(getConfigHint(authenticationSession, config)).toStrictEqual("test@lindorm.io");
  });

  test("should resolve phone", () => {
    config.hintType = "phone";

    expect(getConfigHint(authenticationSession, config)).toStrictEqual("0701234567");
  });

  test("should resolve null", () => {
    config.hintType = "none";

    expect(getConfigHint(authenticationSession, config)).toStrictEqual(null);
  });
});
