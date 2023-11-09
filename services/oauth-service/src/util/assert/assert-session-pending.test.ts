import { SessionStatus } from "@lindorm-io/common-enums";
import { ClientError } from "@lindorm-io/errors";
import { assertSessionPending } from "./assert-session-pending";

describe("assertSessionPending", () => {
  test("should resolve", () => {
    expect(() => assertSessionPending(SessionStatus.PENDING)).not.toThrow();
  });

  test("should throw", () => {
    expect(() => assertSessionPending(SessionStatus.CONFIRMED)).toThrow(ClientError);
  });
});
