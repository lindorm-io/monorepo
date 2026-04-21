import { PylonRouter } from "../../classes/PylonRouter";
import { PylonHttpContext, PylonHttpRouters } from "../../types";
import { normaliseRoutes } from "./normalise-routes";
import { describe, expect, test } from "vitest";

type Routers = PylonHttpRouters<PylonHttpContext>;

describe("normaliseRoutes", () => {
  test("should return empty array when input is undefined", () => {
    expect(normaliseRoutes(undefined)).toEqual([]);
  });

  test("should wrap a bare string in an array", () => {
    expect(normaliseRoutes("/some/path")).toEqual(["/some/path"]);
  });

  test("should wrap a bare Routers object in an array", () => {
    const entry: Routers = { path: "/api", router: new PylonRouter() };

    expect(normaliseRoutes(entry)).toEqual([entry]);
  });

  test("should pass through an array of strings unchanged", () => {
    const input = ["/one", "/two"];

    expect(normaliseRoutes(input)).toBe(input);
  });

  test("should pass through an array of Routers unchanged", () => {
    const input: Array<Routers> = [
      { path: "/api", router: new PylonRouter() },
      { path: "/v1", router: new PylonRouter() },
    ];

    expect(normaliseRoutes(input)).toBe(input);
  });

  test("should pass through a mixed array of strings and Routers", () => {
    const input: Array<string | Routers> = [
      "/scan/path",
      { path: "/api", router: new PylonRouter() },
    ];

    expect(normaliseRoutes(input)).toBe(input);
  });
});
