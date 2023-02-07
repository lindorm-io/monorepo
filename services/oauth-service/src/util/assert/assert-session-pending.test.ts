import { assertSessionPending } from "./assert-session-pending";
import { ClientError } from "@lindorm-io/errors";

describe("assertSessionPending", () => {
  test("should resolve", () => {
    expect(() => assertSessionPending("pending")).not.toThrow();
  });

  test("should throw", () => {
    expect(() => assertSessionPending("confirmed")).toThrow(ClientError);
  });
});
