import { createMockLogger, ILogger } from "@lindorm/logger";
import { join } from "path";
import { PylonRouter } from "../PylonRouter";
import { PylonRouterScanner } from "./PylonRouterScanner";

describe("PylonRouterScanner", () => {
  let logger: ILogger;
  let httpRoutersDirectory: string;
  let scanner: PylonRouterScanner<any>;

  beforeEach(() => {
    logger = createMockLogger();
    httpRoutersDirectory = join(__dirname, "..", "..", "..", "example", "routers");
    scanner = new PylonRouterScanner(logger);
  });

  test("should return router", () => {
    expect(scanner.scan(httpRoutersDirectory)).toEqual(expect.any(PylonRouter));
  });
});
