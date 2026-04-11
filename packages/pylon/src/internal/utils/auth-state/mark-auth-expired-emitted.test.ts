import { PylonSocketAuth } from "../../../types";
import { markAuthExpiredEmitted } from "./mark-auth-expired-emitted";

describe("markAuthExpiredEmitted", () => {
  test("mutates authExpiredEmittedAt to the given date", () => {
    const auth: PylonSocketAuth = {
      strategy: "bearer",
      getExpiresAt: () => new Date("2026-04-11T12:05:00.000Z"),
      refresh: async () => {},
      authExpiredEmittedAt: null,
    };

    markAuthExpiredEmitted(auth, new Date("2026-04-11T12:00:00.000Z"));

    expect(auth.authExpiredEmittedAt).toMatchSnapshot();
  });
});
