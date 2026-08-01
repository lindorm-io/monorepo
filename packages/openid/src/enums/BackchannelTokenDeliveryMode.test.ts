import { describe, expect, test } from "vitest";
import { BackchannelTokenDeliveryMode } from "./BackchannelTokenDeliveryMode.js";

describe("BackchannelTokenDeliveryMode", () => {
  test("should match snapshot", () => {
    expect(BackchannelTokenDeliveryMode).toMatchSnapshot();
  });

  test("should carry the CIBA Core 1.0 delivery modes", () => {
    expect(Object.values(BackchannelTokenDeliveryMode)).toEqual(["ping", "poll", "push"]);
  });

  test("should derive a closed type from the runtime values", () => {
    const fromEnum: BackchannelTokenDeliveryMode = BackchannelTokenDeliveryMode.Poll;
    const fromLiteral: BackchannelTokenDeliveryMode = "push";

    expect([fromEnum, fromLiteral]).toMatchSnapshot();
  });
});
