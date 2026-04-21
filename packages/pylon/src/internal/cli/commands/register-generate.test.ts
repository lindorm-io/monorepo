import { Command } from "commander";
import { registerGenerateCommands } from "./register-generate.js";
import { generateRoute } from "./generate-route.js";
import { generateListener } from "./generate-listener.js";
import { generateMiddleware } from "./generate-middleware.js";
import { generateHandler } from "./generate-handler.js";
import { generateWorker } from "./generate-worker.js";
import { beforeEach, describe, expect, it, vi, type MockedFunction } from "vitest";

vi.mock("./generate-route.js", async () => ({
  generateRoute: vi.fn(),
}));

vi.mock("./generate-listener.js", () => ({
  generateListener: vi.fn(),
}));

vi.mock("./generate-middleware.js", () => ({
  generateMiddleware: vi.fn(),
}));

vi.mock("./generate-handler.js", () => ({
  generateHandler: vi.fn(),
}));

vi.mock("./generate-worker.js", () => ({
  generateWorker: vi.fn(),
}));

const mockGenerateRoute = generateRoute as MockedFunction<typeof generateRoute>;
const mockGenerateListener = generateListener as MockedFunction<typeof generateListener>;
const mockGenerateMiddleware = generateMiddleware as MockedFunction<
  typeof generateMiddleware
>;
const mockGenerateHandler = generateHandler as MockedFunction<typeof generateHandler>;
const mockGenerateWorker = generateWorker as MockedFunction<typeof generateWorker>;

describe("registerGenerateCommands", () => {
  let program: Command;
  let generateCmd: Command;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    program.exitOverride();
    registerGenerateCommands(program);
    generateCmd = program.commands.find((c) => c.name() === "generate")!;
  });

  it("should register a 'generate' command on the program", () => {
    expect(generateCmd).toBeDefined();
  });

  it("should register 'g' as alias for generate", () => {
    expect(generateCmd.alias()).toBe("g");
  });

  describe("route subcommand", () => {
    it("should register a 'route' subcommand", () => {
      const cmd = generateCmd.commands.find((c) => c.name() === "route");
      expect(cmd).toBeDefined();
    });

    it("should register 'r' as alias for route", () => {
      const cmd = generateCmd.commands.find((c) => c.name() === "route")!;
      expect(cmd.alias()).toBe("r");
    });

    it("should register --directory option on route", () => {
      const cmd = generateCmd.commands.find((c) => c.name() === "route")!;
      const opt = cmd.options.find((o) => o.long === "--directory");
      expect(opt).toBeDefined();
      expect(opt!.short).toBe("-d");
    });

    it("should register --dry-run option on route", () => {
      const cmd = generateCmd.commands.find((c) => c.name() === "route")!;
      const opt = cmd.options.find((o) => o.long === "--dry-run");
      expect(opt).toBeDefined();
    });

    it("should wire generateRoute as the action", async () => {
      mockGenerateRoute.mockResolvedValue(undefined);

      await program.parseAsync([
        "node",
        "pylon",
        "generate",
        "route",
        "GET,POST",
        "/v1/users",
      ]);

      expect(mockGenerateRoute).toHaveBeenCalledTimes(1);
    });

    it("should pass methods and path arguments through", async () => {
      mockGenerateRoute.mockResolvedValue(undefined);

      await program.parseAsync([
        "node",
        "pylon",
        "generate",
        "route",
        "GET,POST",
        "/v1/users/:id",
      ]);

      const [methods, path] = mockGenerateRoute.mock.calls[0];
      expect(methods).toBe("GET,POST");
      expect(path).toBe("/v1/users/:id");
    });

    it("should work with aliases", async () => {
      mockGenerateRoute.mockResolvedValue(undefined);

      await program.parseAsync(["node", "pylon", "g", "r", "GET", "/v1/health"]);

      expect(mockGenerateRoute).toHaveBeenCalledTimes(1);
      expect(mockGenerateRoute.mock.calls[0][0]).toBe("GET");
    });
  });

  describe("listener subcommand", () => {
    it("should register a 'listener' subcommand", () => {
      const cmd = generateCmd.commands.find((c) => c.name() === "listener");
      expect(cmd).toBeDefined();
    });

    it("should register 'l' as alias for listener", () => {
      const cmd = generateCmd.commands.find((c) => c.name() === "listener")!;
      expect(cmd.alias()).toBe("l");
    });

    it("should register --dry-run option on listener", () => {
      const cmd = generateCmd.commands.find((c) => c.name() === "listener")!;
      const opt = cmd.options.find((o) => o.long === "--dry-run");
      expect(opt).toBeDefined();
    });

    it("should wire generateListener as the action", async () => {
      mockGenerateListener.mockResolvedValue(undefined);

      await program.parseAsync([
        "node",
        "pylon",
        "generate",
        "listener",
        "ON",
        "chat:message",
      ]);

      expect(mockGenerateListener).toHaveBeenCalledTimes(1);
    });

    it("should pass bindings and event arguments through", async () => {
      mockGenerateListener.mockResolvedValue(undefined);

      await program.parseAsync([
        "node",
        "pylon",
        "generate",
        "listener",
        "ON,ONCE",
        "chat:message",
      ]);

      const [bindings, event] = mockGenerateListener.mock.calls[0];
      expect(bindings).toBe("ON,ONCE");
      expect(event).toBe("chat:message");
    });

    it("should work with aliases", async () => {
      mockGenerateListener.mockResolvedValue(undefined);

      await program.parseAsync(["node", "pylon", "g", "l", "ON", "user:join"]);

      expect(mockGenerateListener).toHaveBeenCalledTimes(1);
      expect(mockGenerateListener.mock.calls[0][0]).toBe("ON");
      expect(mockGenerateListener.mock.calls[0][1]).toBe("user:join");
    });
  });

  describe("middleware subcommand", () => {
    it("should register a 'middleware' subcommand", () => {
      const cmd = generateCmd.commands.find((c) => c.name() === "middleware");
      expect(cmd).toBeDefined();
    });

    it("should register 'm' as alias for middleware", () => {
      const cmd = generateCmd.commands.find((c) => c.name() === "middleware")!;
      expect(cmd.alias()).toBe("m");
    });

    it("should register --socket option on middleware", () => {
      const cmd = generateCmd.commands.find((c) => c.name() === "middleware")!;
      const opt = cmd.options.find((o) => o.long === "--socket");
      expect(opt).toBeDefined();
      expect(opt!.short).toBe("-S");
    });

    it("should register --dry-run option on middleware", () => {
      const cmd = generateCmd.commands.find((c) => c.name() === "middleware")!;
      const opt = cmd.options.find((o) => o.long === "--dry-run");
      expect(opt).toBeDefined();
    });

    it("should wire generateMiddleware as the action", async () => {
      mockGenerateMiddleware.mockResolvedValue(undefined);

      await program.parseAsync(["node", "pylon", "generate", "middleware", "/v1/admin"]);

      expect(mockGenerateMiddleware).toHaveBeenCalledTimes(1);
    });

    it("should pass path argument through", async () => {
      mockGenerateMiddleware.mockResolvedValue(undefined);

      await program.parseAsync(["node", "pylon", "generate", "middleware", "/v1/admin"]);

      const [path] = mockGenerateMiddleware.mock.calls[0];
      expect(path).toBe("/v1/admin");
    });

    it("should work with aliases", async () => {
      mockGenerateMiddleware.mockResolvedValue(undefined);

      await program.parseAsync(["node", "pylon", "g", "m", "chat"]);

      expect(mockGenerateMiddleware).toHaveBeenCalledTimes(1);
      expect(mockGenerateMiddleware.mock.calls[0][0]).toBe("chat");
    });
  });

  describe("handler subcommand", () => {
    it("should register a 'handler' subcommand", () => {
      const cmd = generateCmd.commands.find((c) => c.name() === "handler");
      expect(cmd).toBeDefined();
    });

    it("should register 'h' as alias for handler", () => {
      const cmd = generateCmd.commands.find((c) => c.name() === "handler")!;
      expect(cmd.alias()).toBe("h");
    });

    it("should register --directory option on handler", () => {
      const cmd = generateCmd.commands.find((c) => c.name() === "handler")!;
      const opt = cmd.options.find((o) => o.long === "--directory");
      expect(opt).toBeDefined();
      expect(opt!.short).toBe("-d");
    });

    it("should register --dry-run option on handler", () => {
      const cmd = generateCmd.commands.find((c) => c.name() === "handler")!;
      const opt = cmd.options.find((o) => o.long === "--dry-run");
      expect(opt).toBeDefined();
    });

    it("should wire generateHandler as the action", async () => {
      mockGenerateHandler.mockResolvedValue(undefined);

      await program.parseAsync(["node", "pylon", "generate", "handler", "getUser"]);

      expect(mockGenerateHandler).toHaveBeenCalledTimes(1);
    });

    it("should pass name argument through", async () => {
      mockGenerateHandler.mockResolvedValue(undefined);

      await program.parseAsync(["node", "pylon", "generate", "handler", "getUser"]);

      const [name] = mockGenerateHandler.mock.calls[0];
      expect(name).toBe("getUser");
    });

    it("should work with aliases", async () => {
      mockGenerateHandler.mockResolvedValue(undefined);

      await program.parseAsync(["node", "pylon", "g", "h", "createOrder"]);

      expect(mockGenerateHandler).toHaveBeenCalledTimes(1);
      expect(mockGenerateHandler.mock.calls[0][0]).toBe("createOrder");
    });
  });

  describe("worker subcommand", () => {
    it("should register a 'worker' subcommand", () => {
      const cmd = generateCmd.commands.find((c) => c.name() === "worker");
      expect(cmd).toBeDefined();
    });

    it("should register 'w' as alias for worker", () => {
      const cmd = generateCmd.commands.find((c) => c.name() === "worker")!;
      expect(cmd.alias()).toBe("w");
    });

    it("should register --directory option on worker", () => {
      const cmd = generateCmd.commands.find((c) => c.name() === "worker")!;
      const opt = cmd.options.find((o) => o.long === "--directory");
      expect(opt).toBeDefined();
      expect(opt!.short).toBe("-d");
    });

    it("should register --dry-run option on worker", () => {
      const cmd = generateCmd.commands.find((c) => c.name() === "worker")!;
      const opt = cmd.options.find((o) => o.long === "--dry-run");
      expect(opt).toBeDefined();
    });

    it("should wire generateWorker as the action", async () => {
      mockGenerateWorker.mockResolvedValue(undefined);

      await program.parseAsync([
        "node",
        "pylon",
        "generate",
        "worker",
        "HeartbeatWorker",
      ]);

      expect(mockGenerateWorker).toHaveBeenCalledTimes(1);
    });

    it("should pass name argument through", async () => {
      mockGenerateWorker.mockResolvedValue(undefined);

      await program.parseAsync([
        "node",
        "pylon",
        "generate",
        "worker",
        "HeartbeatWorker",
      ]);

      const [name] = mockGenerateWorker.mock.calls[0];
      expect(name).toBe("HeartbeatWorker");
    });

    it("should work with aliases", async () => {
      mockGenerateWorker.mockResolvedValue(undefined);

      await program.parseAsync(["node", "pylon", "g", "w", "CleanupWorker"]);

      expect(mockGenerateWorker).toHaveBeenCalledTimes(1);
      expect(mockGenerateWorker.mock.calls[0][0]).toBe("CleanupWorker");
    });
  });
});
