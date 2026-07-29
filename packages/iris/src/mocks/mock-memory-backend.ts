import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import { IrisSource } from "../classes/IrisSource.js";
import type {
  IIrisMessageBus,
  IIrisPublisher,
  IIrisRpcClient,
  IIrisSession,
  IIrisSource,
  IIrisWorkerQueue,
  IMessage,
} from "../interfaces/index.js";
import type { IrisCapabilities } from "../types/index.js";
import { MEMORY_CAPABILITIES } from "../internal/drivers/memory/memory-capabilities.js";
import type { CreateMockIrisSettings } from "./create-mock-iris-settings.js";

type MockFn = () => any;

/**
 * Every method on each messaging surface. Each is spy-wrapped so its default
 * implementation delegates DIRECTLY to the real in-memory object — the one that
 * actually delivers. Every one stays a spy, overridable via `mockResolvedValue`
 * etc.
 */
const BUS_METHODS = [
  "create",
  "hydrate",
  "copy",
  "validate",
  "publish",
  "subscribe",
  "unsubscribe",
  "unsubscribeAll",
] as const;

const PUBLISHER_METHODS = ["create", "hydrate", "copy", "validate", "publish"] as const;

const WORKER_QUEUE_METHODS = [
  "create",
  "hydrate",
  "copy",
  "validate",
  "publish",
  "consume",
  "unconsume",
  "unconsumeAll",
] as const;

const RPC_CLIENT_METHODS = ["request", "close"] as const;

/**
 * A memory-backed mock backend. Builds ONE real `IrisSource({ driver: "memory"
 * })` over the PUBLIC API, `connect()`s and `setup()`s it, then hands out
 * spy-wrapped source / session / messageBus / publisher / workerQueue / rpcClient
 * facades whose defaults delegate DIRECTLY to the real in-memory driver — the one
 * that publishes to real subscribers and completes RPC round-trips in-process.
 *
 * There is no lazy connect: the source is fully live before any facade is
 * returned, and tests assert via real delivery — register a subscriber, `await
 * publish(msg)`, then assert the callback fired (delivery is awaited inline).
 * Every facade method stays a spy (overridable via `mockResolvedValueOnce` etc.);
 * the default just runs the faithful memory path.
 */
export const createMemoryIrisBackend = async (
  mockFn: MockFn,
  createLogger: () => ILogger,
  settings?: CreateMockIrisSettings,
) => {
  const logger = settings?.logger ?? createLogger();

  const source = new IrisSource({
    driver: "memory",
    logger,
    messages: settings?.messages,
  });

  // Connect BEFORE setup — setup() needs the driver (requireDriver throws
  // otherwise). setup() scans any string-path messages, validates encrypted
  // messages, and is a no-op on the driver itself.
  await source.connect();
  await source.setup();

  const capabilities: IrisCapabilities = {
    ...MEMORY_CAPABILITIES,
    ...settings?.capabilities,
  };

  const spyImpl = (fn: (...args: Array<any>) => any) => {
    const m = mockFn();
    m.mockImplementation(fn);
    return m;
  };

  const wrapWith = <T>(real: T, methods: ReadonlyArray<string>): T => {
    const facade: Record<string, unknown> = {};
    for (const name of methods) {
      facade[name] = spyImpl((...args: Array<any>) => (real as any)[name](...args));
    }
    return facade as unknown as T;
  };

  // ─── Facade messaging surfaces (memory-backed, real delivery) ──────────

  const wrapMessageBus = <M extends IMessage>(
    real: IIrisMessageBus<M>,
  ): IIrisMessageBus<M> => wrapWith(real, BUS_METHODS);

  const wrapPublisher = <M extends IMessage>(
    real: IIrisPublisher<M>,
  ): IIrisPublisher<M> => wrapWith(real, PUBLISHER_METHODS);

  const wrapWorkerQueue = <M extends IMessage>(
    real: IIrisWorkerQueue<M>,
  ): IIrisWorkerQueue<M> => wrapWith(real, WORKER_QUEUE_METHODS);

  const wrapRpcClient = <Req extends IMessage, Res extends IMessage>(
    real: IIrisRpcClient<Req, Res>,
  ): IIrisRpcClient<Req, Res> => wrapWith(real, RPC_CLIENT_METHODS);

  // ─── Facade messaging provider (shared by source + session) ────────────

  const wrapProvider = (real: IIrisSource | IIrisSession) => ({
    driver: real.driver,

    hasMessage: spyImpl((target: Constructor<any>) => real.hasMessage(target)),
    ping: spyImpl(() => real.ping()),

    messageBus: spyImpl((target: Constructor<any>) =>
      wrapMessageBus(real.messageBus(target)),
    ),
    publisher: spyImpl((target: Constructor<any>) =>
      wrapPublisher(real.publisher(target)),
    ),
    workerQueue: spyImpl((target: Constructor<any>) =>
      wrapWorkerQueue(real.workerQueue(target)),
    ),
    stream: spyImpl(() => real.stream()),
    rpcClient: spyImpl(
      (requestTarget: Constructor<any>, responseTarget: Constructor<any>) =>
        wrapRpcClient(real.rpcClient(requestTarget, responseTarget)),
    ),
    rpcServer: spyImpl(
      (requestTarget: Constructor<any>, responseTarget: Constructor<any>) =>
        real.rpcServer(requestTarget, responseTarget),
    ),
  });

  const wrapSession = (real: IIrisSession): IIrisSession =>
    wrapProvider(real) as unknown as IIrisSession;

  const makeFacadeSession = (): IIrisSession => wrapSession(source.session());

  const makeFacadeSource = (): IIrisSource =>
    ({
      ...wrapProvider(source),

      messages: source.messages,
      capabilities,

      addMessages: spyImpl((input: any) => source.addMessages(input)),
      addSubscriber: spyImpl((subscriber: any) => source.addSubscriber(subscriber)),
      removeSubscriber: spyImpl((subscriber: any) => source.removeSubscriber(subscriber)),
      session: spyImpl((options?: any) => wrapSession(source.session(options))),

      // Lifecycle is already done — these stay inert spies so a stray call cannot
      // tear down / re-create the driver (which would wipe the in-memory store).
      connect: mockFn(),
      disconnect: mockFn(),
      setup: mockFn(),

      drain: spyImpl((timeout?: any) => source.drain(timeout)),
      getDeadLetters: spyImpl((options?: any) => source.getDeadLetters(options)),
      purgeDeadLetters: spyImpl((options?: any) => source.purgeDeadLetters(options)),
      getConnectionState: spyImpl(() => source.getConnectionState()),
      on: spyImpl((event: any, listener: any) => source.on(event, listener)),
      off: spyImpl((event: any, listener: any) => source.off(event, listener)),
      once: spyImpl((event: any, listener: any) => source.once(event, listener)),
    }) as unknown as IIrisSource;

  const makeFacadeMessageBus = <M extends IMessage>(
    target: Constructor<M>,
  ): IIrisMessageBus<M> => wrapMessageBus(source.messageBus(target));

  const makeFacadePublisher = <M extends IMessage>(
    target: Constructor<M>,
  ): IIrisPublisher<M> => wrapPublisher(source.publisher(target));

  const makeFacadeWorkerQueue = <M extends IMessage>(
    target: Constructor<M>,
  ): IIrisWorkerQueue<M> => wrapWorkerQueue(source.workerQueue(target));

  /**
   * A spy-wrapped real RPC client. A memory RPC client only resolves a request
   * once a server serves the same request/response pair on the shared store —
   * without one `request()` faithfully rejects with `IrisTransportError` (no
   * handler). Pass `responseFactory` to stand up a real server that responds via
   * the factory, so `request()` completes a genuine in-process round-trip.
   */
  const makeFacadeRpcClient = async <Req extends IMessage, Res extends IMessage>(
    requestTarget: Constructor<Req>,
    responseTarget: Constructor<Res>,
    responseFactory?: (request: Req) => Res | Promise<Res>,
  ): Promise<IIrisRpcClient<Req, Res>> => {
    if (responseFactory) {
      const server = source.rpcServer(requestTarget, responseTarget);
      await server.serve(async (request) => responseFactory(request));
    }
    return wrapRpcClient(source.rpcClient(requestTarget, responseTarget));
  };

  return {
    source,
    makeFacadeSource,
    makeFacadeSession,
    makeFacadeMessageBus,
    makeFacadePublisher,
    makeFacadeWorkerQueue,
    makeFacadeRpcClient,
  };
};
