import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import type { IIrisDriver } from "../../../../interfaces/IrisDriver.js";
import type {
  IIrisMessageBus,
  IIrisPublisher,
  IIrisStreamProcessor,
  IIrisWorkerQueue,
  IMessage,
  IMessageSubscriber,
} from "../../../../interfaces/index.js";
import type { IrisCapabilities, IrisHookMeta } from "../../../../types/index.js";
import { MEMORY_CAPABILITIES } from "../memory-capabilities.js";
import { IrisTransportError } from "../../../../errors/IrisTransportError.js";
import type {
  DeadLetterEntry,
  DeadLetterFilterOptions,
  DeadLetterListOptions,
} from "../../../../types/dead-letter.js";
import type { DeadLetterManager } from "../../../dead-letter/DeadLetterManager.js";
import type { DelayManager } from "../../../delay/DelayManager.js";
import type { MessageEncryptionContext } from "../../../message/types/encryption-context.js";
import { ConnectionDriverBase } from "../../../classes/ConnectionDriverBase.js";
import type { MemorySharedState } from "../types/memory-store.js";
import { createStore } from "../utils/create-store.js";
import { dispatchToConsumers } from "../utils/dispatch-to-consumers.js";
import { dispatchToSubscribers } from "../utils/dispatch-to-subscribers.js";
import { MemoryMessageBus } from "./MemoryMessageBus.js";
import { MemoryPublisher } from "./MemoryPublisher.js";
import { MemoryRpcClient } from "./MemoryRpcClient.js";
import { MemoryRpcServer } from "./MemoryRpcServer.js";
import { MemoryStreamProcessor } from "./MemoryStreamProcessor.js";
import { MemoryWorkerQueue } from "./MemoryWorkerQueue.js";

export type MemoryDriverOptions = {
  logger: ILogger;
  meta?: IrisHookMeta;
  encryption?: MessageEncryptionContext;
  getSubscribers: () => Array<IMessageSubscriber>;
  delayManager?: DelayManager;
  deadLetterManager?: DeadLetterManager;
};

export class MemoryDriver extends ConnectionDriverBase {
  readonly capabilities: IrisCapabilities = MEMORY_CAPABILITIES;
  private readonly store: MemorySharedState;
  private readonly delayManager: DelayManager | undefined;
  private readonly deadLetterManager: DeadLetterManager | undefined;

  constructor(options: MemoryDriverOptions, store?: MemorySharedState) {
    super({
      driverType: "memory",
      loggerLabel: "MemoryDriver",
      logger: options.logger,
      meta: options.meta,
      encryption: options.encryption,
      getSubscribers: options.getSubscribers,
    });
    this.store = store ?? createStore();
    this.delayManager = options.delayManager;
    this.deadLetterManager = options.deadLetterManager;
  }

  protected async doConnect(): Promise<void> {
    this.setConnectionState("connecting");

    if (this.delayManager) {
      this.delayManager.start(async (entry) => {
        await dispatchToSubscribers(this.store, entry.envelope);
        await dispatchToConsumers(this.store, entry.envelope);
      });
    }

    this.setConnectionState("connected");
    this.logger.info("Connected");
  }

  async disconnect(): Promise<void> {
    if (this.delayManager) {
      this.delayManager.stop();
    }

    const disconnectedError = new IrisTransportError(
      "Driver disconnected while RPC request was pending",
    );
    for (const [, rejectFn] of this.store.pendingRejects) {
      rejectFn(disconnectedError);
    }
    this.store.pendingRejects.clear();

    for (const timer of this.store.timers) {
      clearTimeout(timer);
    }
    this.store.timers.clear();

    this.store.subscriptions.length = 0;
    this.store.consumers.length = 0;
    this.store.rpcHandlers.length = 0;
    this.store.roundRobinIndexes.clear();
    this._replyQueueActive = false;
    this.setConnectionState("disconnected");
    this.logger.info("Disconnected");
  }

  protected getInFlightCount(): number {
    return this.store.inFlightCount;
  }

  protected async beforeDrain(): Promise<void> {
    // Pause dispatching — new messages go to the store but callbacks are suppressed.
    this.store.paused = true;
  }

  protected async afterDrain(): Promise<void> {
    this.store.paused = false;
  }

  async ping(): Promise<boolean> {
    // Intentionally a no-op wire probe: the memory driver is fully in-process
    // with no transport to round-trip against, so connection state IS the
    // health signal. (Contrast the network drivers, which must touch the wire.)
    return this.getConnectionState() === "connected";
  }

  async reset(): Promise<void> {
    this.store.subscriptions.length = 0;
    this.store.consumers.length = 0;
    this.store.rpcHandlers.length = 0;
    this.store.roundRobinIndexes.clear();

    for (const timer of this.store.timers) {
      clearTimeout(timer);
    }
    this.store.timers.clear();

    this.store.pendingRejects.clear();
    this.store.inFlightCount = 0;

    this.logger.debug("Reset");
  }

  async setup(_messages: Array<Constructor<IMessage>>): Promise<void> {
    this.logger.debug("Setup (no-op for memory driver)");
  }

  protected buildPublisher<M extends IMessage>(
    target: Constructor<M>,
  ): IIrisPublisher<M> {
    return new MemoryPublisher<M>({
      ...this.sharedPatternOptions(target),
      store: this.store,
      delayManager: this.delayManager,
    });
  }

  protected buildMessageBus<M extends IMessage>(
    target: Constructor<M>,
  ): IIrisMessageBus<M> {
    return new MemoryMessageBus<M>({
      ...this.sharedPatternOptions(target),
      store: this.store,
      delayManager: this.delayManager,
      deadLetterManager: this.deadLetterManager,
    });
  }

  protected buildWorkerQueue<M extends IMessage>(
    target: Constructor<M>,
  ): IIrisWorkerQueue<M> {
    return new MemoryWorkerQueue<M>({
      ...this.sharedPatternOptions(target),
      store: this.store,
      delayManager: this.delayManager,
      deadLetterManager: this.deadLetterManager,
    });
  }

  protected buildStreamProcessor(): IIrisStreamProcessor {
    return new MemoryStreamProcessor({
      state: this.store,
      logger: this.logger,
      meta: this.meta,
      encryption: this.encryption,
      deadLetterManager: this.deadLetterManager,
      delayManager: this.delayManager,
    });
  }

  protected buildRpcClient<Req extends IMessage, Res extends IMessage>(
    requestTarget: Constructor<Req>,
    responseTarget: Constructor<Res>,
  ): MemoryRpcClient<Req, Res> {
    return new MemoryRpcClient({
      store: this.store,
      logger: this.logger,
      requestTarget,
      responseTarget,
      meta: this.meta,
      encryption: this.encryption,
    });
  }

  protected buildRpcServer<Req extends IMessage, Res extends IMessage>(
    requestTarget: Constructor<Req>,
    responseTarget: Constructor<Res>,
  ): MemoryRpcServer<Req, Res> {
    return new MemoryRpcServer({
      store: this.store,
      logger: this.logger,
      requestTarget,
      responseTarget,
      meta: this.meta,
      encryption: this.encryption,
    });
  }

  cloneWithGetters(getSubscribers: () => Array<IMessageSubscriber>): IIrisDriver {
    return new MemoryDriver(
      {
        logger: this.logger,
        meta: this.meta,
        encryption: this.encryption,
        getSubscribers,
        delayManager: this.delayManager,
        deadLetterManager: this.deadLetterManager,
      },
      this.store,
    );
  }

  async getDeadLetters(options?: DeadLetterListOptions): Promise<Array<DeadLetterEntry>> {
    if (!this.deadLetterManager) return [];
    return this.deadLetterManager.list(options);
  }

  async purgeDeadLetters(options?: DeadLetterFilterOptions): Promise<number> {
    if (!this.deadLetterManager) return 0;
    return this.deadLetterManager.purge(options);
  }
}
