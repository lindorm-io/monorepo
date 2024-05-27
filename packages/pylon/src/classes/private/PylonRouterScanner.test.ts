import { createMockLogger } from "@lindorm/logger";
import { join } from "path";
import { PylonRouter } from "../PylonRouter";
import { PylonRouterScanner } from "./PylonRouterScanner";

describe("PylonRouterScanner", () => {
  const logger = createMockLogger();
  const httpRoutersDirectory = join(__dirname, "..", "..", "..", "example", "routers");
  const scanner = new PylonRouterScanner(logger);

  test("should return router", () => {
    expect(scanner.scan(httpRoutersDirectory)).toEqual(expect.any(PylonRouter));
  });
});
