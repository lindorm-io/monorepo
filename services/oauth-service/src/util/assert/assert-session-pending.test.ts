import { assertSessionPending } from "./assert-session-pending";
import { SessionStatus } from "../../common";
import { ClientError } from "@lindorm-io/errors";

describe("assertSessionPending", () => {
  test("should resolve", () => {
    expect(() => assertSessionPending(SessionStatus.PENDING)).not.toThrow();
  });

  test("should throw", () => {
    expect(() => assertSessionPending(SessionStatus.CONFIRMED)).toThrow(ClientError);
  });
});
