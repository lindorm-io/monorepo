import { assertSessionPending } from "./assert-session-pending";
import { ClientError } from "@lindorm-io/errors";
import { SessionStatus } from "@lindorm-io/common-types";

describe("assertSessionPending", () => {
  test("should resolve", () => {
    expect(() => assertSessionPending(SessionStatus.PENDING)).not.toThrow();
  });

  test("should throw", () => {
    expect(() => assertSessionPending(SessionStatus.CONFIRMED)).toThrow(ClientError);
  });
});
