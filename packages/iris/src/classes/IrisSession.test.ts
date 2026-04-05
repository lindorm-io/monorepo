import type { IIrisDriver } from "../interfaces/IrisDriver";
import { IrisSession, type IrisSessionOptions } from "./IrisSession";

// --- Helpers ---

const createMockLogger = () => ({
  child: jest.fn().mockReturnThis(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  silly: jest.fn(),
  verbose: jest.fn(),
});

const createMockDriver = (): IIrisDriver => ({
  connect: jest.fn(),
  disconnect: jest.fn(),
  drain: jest.fn().mockResolvedValue(undefined),
  ping: jest.fn().mockResolvedValue(true),
  setup: jest.fn().mockResolvedValue(undefined),
  getConnectionState: jest.fn().mockReturnValue("connected"),
  on: jest.fn(),
  off: jest.fn(),
  once: jest.fn(),
  createMessageBus: jest.fn().mockReturnValue({ publish: jest.fn() }),
  createPublisher: jest.fn().mockReturnValue({ publish: jest.fn() }),
  createWorkerQueue: jest.fn().mockReturnValue({ subscribe: jest.fn() }),
  createStreamProcessor: jest.fn().mockReturnValue({ pipe: jest.fn() }),
  createRpcClient: jest.fn().mockReturnValue({ request: jest.fn() }),
  createRpcServer: jest.fn().mockReturnValue({ serve: jest.fn() }),
  cloneWithGetters: jest.fn(),
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
  context: { tenant: "test" },
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
