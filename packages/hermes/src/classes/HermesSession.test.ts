import { LindormError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { HermesStatus } from "../types/hermes-status";
import { HermesSession } from "./HermesSession";
import type { HermesSessionOptions } from "./HermesSession";
import { describe, expect, it, vi } from "vitest";

// Minimal stubs for the dependencies HermesSession actually uses
const createOptions = (
  overrides: Partial<HermesSessionOptions> = {},
): HermesSessionOptions => ({
  logger: createMockLogger(),
  statusRef: { current: "ready" },
  registry: {
    getCommand: vi.fn().mockReturnValue({ name: "TestCommand", version: 1 }),
    getCommandHandler: vi.fn().mockReturnValue({
      aggregate: { name: "TestAggregate", namespace: "test" },
    }),
  } as any,
  viewDomain: {
    query: vi.fn().mockResolvedValue({ result: "ok" }),
  } as any,
  commandQueue: {
    create: vi.fn().mockReturnValue({ id: "msg-id" }),
    publish: vi.fn().mockResolvedValue(undefined),
  } as any,
  ...overrides,
});

// extractDto is used internally — mock it to return predictable data
vi.mock("../internal/utils", async () => ({
  extractDto: vi.fn().mockReturnValue({ data: { foo: "bar" } }),
}));

describe("HermesSession", () => {
  describe("status", () => {
    it("should return the current status from statusRef", () => {
      const statusRef: { current: HermesStatus } = { current: "ready" };
      const session = new HermesSession(createOptions({ statusRef }));

      expect(session.status).toEqual("ready");

      statusRef.current = "stopping";
      expect(session.status).toEqual("stopping");
    });
  });

  describe("command", () => {
    it("should delegate to commandQueue", async () => {
      const opts = createOptions();
      const session = new HermesSession(opts);

      const command = { constructor: class TestCommand {} };

      const result = await session.command(command as any);

      expect(opts.registry.getCommand).toHaveBeenCalledWith(command.constructor);
      expect(opts.registry.getCommandHandler).toHaveBeenCalledWith(command.constructor);
      expect(opts.commandQueue.create).toHaveBeenCalled();
      expect(opts.commandQueue.publish).toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          name: "TestAggregate",
          namespace: "test",
        }),
      );
    });

    it("should throw when not ready", async () => {
      const session = new HermesSession(
        createOptions({ statusRef: { current: "created" } }),
      );

      await expect(session.command({} as any)).rejects.toThrow(LindormError);
    });

    it("should throw when handler not registered", async () => {
      const session = new HermesSession(
        createOptions({
          registry: {
            getCommand: vi.fn().mockReturnValue({ name: "X", version: 1 }),
            getCommandHandler: vi.fn().mockReturnValue(null),
          } as any,
        }),
      );

      await expect(session.command({ constructor: class X {} } as any)).rejects.toThrow();
    });
  });

  describe("query", () => {
    it("should delegate to viewDomain.query", async () => {
      const opts = createOptions();
      const session = new HermesSession(opts);

      const query = { constructor: class TestQuery {} };
      const result = await session.query(query as any);

      expect(opts.viewDomain.query).toHaveBeenCalledWith(query);
      expect(result).toEqual({ result: "ok" });
    });

    it("should throw when not ready", async () => {
      const session = new HermesSession(
        createOptions({ statusRef: { current: "created" } }),
      );

      await expect(session.query({} as any)).rejects.toThrow(LindormError);
    });
  });
});
