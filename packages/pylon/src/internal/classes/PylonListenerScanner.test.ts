import { createMockLogger } from "@lindorm/logger";
import { join } from "path";
import { PylonListenerScanner } from "./PylonListenerScanner";

describe("PylonListenerScanner", () => {
  const logger = createMockLogger();
  const socketListenersDirectory = join(
    __dirname,
    "..",
    "..",
    "..",
    "example",
    "listeners",
  );
  const scanner = new PylonListenerScanner(logger);

  test("should return listeners", () => {
    expect(scanner.scan(socketListenersDirectory)).toEqual({
      listeners: [
        expect.objectContaining({ namespace: "/authorized", prefix: "listener" }),
        expect.objectContaining({ namespace: null, prefix: "events" }),
        expect.objectContaining({ namespace: "/other", prefix: "message" }),
      ],
      namespaces: ["/authorized", "/other"],
    });
  });
});
