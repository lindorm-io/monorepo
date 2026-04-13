import { AegisError } from "@lindorm/aegis";
import { extractTokenFromSession } from "./extract-token-from-session";

const session = {
  id: "sess-1",
  accessToken: "session-jwt",
  expiresAt: new Date("2026-04-11T13:00:00.000Z"),
  issuedAt: new Date("2026-04-11T12:00:00.000Z"),
  scope: ["openid"],
  subject: "sub",
} as any;

describe("extractTokenFromSession", () => {
  let aegis: any;

  beforeEach(() => {
    aegis = {
      verify: jest.fn().mockResolvedValue({
        token: "session-jwt",
        header: { baseFormat: "JWT" },
      }),
    };
  });

  test("returns parsed token when session has accessToken", async () => {
    expect(await extractTokenFromSession(aegis, session)).toMatchSnapshot();
  });

  test("returns null when session is null", async () => {
    expect(await extractTokenFromSession(aegis, null)).toMatchSnapshot();
  });

  test("returns null when session is undefined", async () => {
    expect(await extractTokenFromSession(aegis, undefined)).toMatchSnapshot();
  });

  test("returns null when accessToken is missing", async () => {
    expect(
      await extractTokenFromSession(aegis, { ...session, accessToken: "" }),
    ).toMatchSnapshot();
  });

  test("returns null when aegis.verify throws AegisError", async () => {
    aegis.verify.mockRejectedValue(new AegisError("bad token"));
    expect(await extractTokenFromSession(aegis, session)).toMatchSnapshot();
  });

  test("returns null when verified token is not jwt kind", async () => {
    aegis.verify.mockResolvedValue({ decoded: {}, header: { baseFormat: "JWS" } });
    expect(await extractTokenFromSession(aegis, session)).toMatchSnapshot();
  });

  test("rethrows non-AegisError", async () => {
    aegis.verify.mockRejectedValue(new TypeError("unexpected"));
    await expect(extractTokenFromSession(aegis, session)).rejects.toThrow(TypeError);
  });
});
