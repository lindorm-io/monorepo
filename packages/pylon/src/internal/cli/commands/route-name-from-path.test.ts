import { describe, expect, test } from "vitest";
import { routeNameFromPath } from "./route-name-from-path.js";

describe("routeNameFromPath", () => {
  test("should derive tail-of-the-path names", () => {
    expect(
      Object.fromEntries(
        [
          "/token",
          "/authorize",
          "/v1/admin/status",
          "/v1/users/:id",
          "/v1/users/[id]",
          "/v1/users/:userId/orders/:orderId",
          "/files/*path",
          "/files/[...path]",
          "/:id",
          "/",
        ].map((path) => [path, routeNameFromPath(path)]),
      ),
    ).toMatchSnapshot();
  });

  test("should keep sibling routes of one feature distinct", () => {
    expect(routeNameFromPath("/token")).not.toBe(routeNameFromPath("/authorize"));
  });
});
