import type { IIrisDriver } from "../interfaces/IrisDriver.js";
import { createDefaultIrisHookMeta } from "../types/iris-hook-meta.js";
import { IrisSession, type IrisSessionOptions } from "./IrisSession.js";
import { describe, expect, it, vi } from "vitest";

// --- Helpers ---

const createMockLogger = () => ({
  child: vi.fn().mockReturnThis(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  silly: vi.fn(),
  verbose: vi.fn(),
});

const createMockDriver = (): IIrisDriver => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  drain: vi.fn().mockResolvedValue(undefined),
  ping: vi.fn().mockResolvedValue(true),
  setup: vi.fn().mockResolvedValue(undefined),
  getConnectionState: vi.fn().mockReturnValue("connected"),
  on: vi.fn(),
  off: vi.fn(),
  once: vi.fn(),
  createMessageBus: vi.fn().mockReturnValue({ publish: vi.fn() }),
  createPublisher: vi.fn().mockReturnValue({ publish: vi.fn() }),
  createWorkerQueue: vi.fn().mockReturnValue({ subscribe: vi.fn() }),
  createStreamProcessor: vi.fn().mockReturnValue({ pipe: vi.fn() }),
  createRpcClient: vi.fn().mockReturnValue({ request: vi.fn() }),
  createRpcServer: vi.fn().mockReturnValue({ serve: vi.fn() }),
  cloneWithGetters: vi.fn(),
});

class FakeMessage {
  id!: string;
}

class FakeRequest {
  id!: string;
}

class FakeResponse {
  id!: string;
}

const createSessionOptions = (
  overrides: Partial<IrisSessionOptions> = {},
): IrisSessionOptions => ({
  logger: createMockLogger() as any,
  context: createDefaultIrisHookMeta(),
  driver: createMockDriver(),
  driverType: "memory",
  messages: [FakeMessage as any],
  ...overrides,
});

// --- Tests ---

describe("IrisSession", () => {
  describe("data-access getters", () => {
    it("should return the driver type", () => {
      const session = new IrisSession(createSessionOptions());
      expect(session.driver).toBe("memory");
    });
  });

  describe("hasMessage", () => {
    it("should return true for a registered message", () => {
      const session = new IrisSession(createSessionOptions());
      expect(session.hasMessage(FakeMessage as any)).toBe(true);
    });

    it("should return false for an unregistered message", () => {
      const session = new IrisSession(createSessionOptions());
      expect(session.hasMessage(FakeResponse as any)).toBe(false);
    });
  });

  describe("ping", () => {
    it("should delegate to driver.ping", async () => {
      const driver = createMockDriver();
      const session = new IrisSession(createSessionOptions({ driver }));

      const result = await session.ping();

      expect(result).toBe(true);
      expect(driver.ping).toHaveBeenCalled();
    });
  });

  describe("messaging methods", () => {
    it("should delegate messageBus to driver", () => {
      const driver = createMockDriver();
      const session = new IrisSession(createSessionOptions({ driver }));

      const result = session.messageBus(FakeMessage as any);

      expect(driver.createMessageBus).toHaveBeenCalledWith(FakeMessage);
      expect(result).toEqual({ publish: expect.any(Function) });
    });

    it("should delegate publisher to driver", () => {
      const driver = createMockDriver();
      const session = new IrisSession(createSessionOptions({ driver }));

      const result = session.publisher(FakeMessage as any);

      expect(driver.createPublisher).toHaveBeenCalledWith(FakeMessage);
      expect(result).toEqual({ publish: expect.any(Function) });
    });

    it("should delegate workerQueue to driver", () => {
      const driver = createMockDriver();
      const session = new IrisSession(createSessionOptions({ driver }));

      const result = session.workerQueue(FakeMessage as any);

      expect(driver.createWorkerQueue).toHaveBeenCalledWith(FakeMessage);
      expect(result).toEqual({ subscribe: expect.any(Function) });
    });

    it("should delegate stream to driver", () => {
      const driver = createMockDriver();
      const session = new IrisSession(createSessionOptions({ driver }));

      const result = session.stream();

      expect(driver.createStreamProcessor).toHaveBeenCalled();
      expect(result).toEqual({ pipe: expect.any(Function) });
    });

    it("should delegate rpcClient to driver", () => {
      const driver = createMockDriver();
      const session = new IrisSession(createSessionOptions({ driver }));

      const result = session.rpcClient(FakeRequest as any, FakeResponse as any);

      expect(driver.createRpcClient).toHaveBeenCalledWith(FakeRequest, FakeResponse);
      expect(result).toEqual({ request: expect.any(Function) });
    });

    it("should delegate rpcServer to driver", () => {
      const driver = createMockDriver();
      const session = new IrisSession(createSessionOptions({ driver }));

      const result = session.rpcServer(FakeRequest as any, FakeResponse as any);

      expect(driver.createRpcServer).toHaveBeenCalledWith(FakeRequest, FakeResponse);
      expect(result).toEqual({ serve: expect.any(Function) });
    });
  });
});
