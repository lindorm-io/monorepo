import { Aegis } from "@lindorm/aegis";
import { extractTokenFromSession } from "./extract-token-from-session";

jest.mock("@lindorm/aegis", () => ({
  Aegis: { parse: jest.fn() },
}));

const session = {
  id: "sess-1",
  accessToken: "session-jwt",
  expiresAt: new Date("2026-04-11T13:00:00.000Z"),
  issuedAt: new Date("2026-04-11T12:00:00.000Z"),
  scope: ["openid"],
  subject: "sub",
} as any;

describe("extractTokenFromSession", () => {
  beforeEach(() => {
    (Aegis.parse as jest.Mock).mockReset();
  });

  test("returns parsed token when session has accessToken", () => {
    (Aegis.parse as jest.Mock).mockReturnValue({ token: "session-jwt" });
    expect(extractTokenFromSession(session)).toMatchSnapshot();
  });

  test("returns null when session is null", () => {
    expect(extractTokenFromSession(null)).toMatchSnapshot();
  });

  test("returns null when session is undefined", () => {
    expect(extractTokenFromSession(undefined)).toMatchSnapshot();
  });

  test("returns null when accessToken is missing", () => {
    expect(extractTokenFromSession({ ...session, accessToken: "" })).toMatchSnapshot();
  });

  test("returns null when Aegis.parse throws", () => {
    (Aegis.parse as jest.Mock).mockImplementation(() => {
      throw new Error("bad token");
    });
    expect(extractTokenFromSession(session)).toMatchSnapshot();
  });
});
