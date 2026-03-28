import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import type { IIrisDriver } from "../../../../interfaces/IrisDriver";
import type {
  IIrisMessageBus,
  IIrisPublisher,
  IIrisStreamProcessor,
  IIrisWorkerQueue,
  IMessage,
  IMessageSubscriber,
} from "../../../../interfaces";
import type { IrisConnectionState } from "../../../../types";
import { IrisTransportError } from "../../../../errors/IrisTransportError";
import type { DeadLetterEntry } from "../../../../types/dead-letter";
import type { DeadLetterManager } from "../../../dead-letter/DeadLetterManager";
import type { DelayManager } from "../../../delay/DelayManager";
import type { IAmphora } from "@lindorm/amphora";
import type { MemorySharedState } from "../types/memory-store";
import { createStore } from "../utils/create-store";
import { dispatchToConsumers } from "../utils/dispatch-to-consumers";
import { dispatchToSubscribers } from "../utils/dispatch-to-subscribers";
import { MemoryMessageBus } from "./MemoryMessageBus";
import { MemoryPublisher } from "./MemoryPublisher";
import { MemoryRpcClient } from "./MemoryRpcClient";
import { MemoryRpcServer } from "./MemoryRpcServer";
import { MemoryStreamProcessor } from "./MemoryStreamProcessor";
import { MemoryWorkerQueue } from "./MemoryWorkerQueue";

export type MemoryDriverOptions = {
  logger: ILogger;
  context?: unknown;
  amphora?: IAmphora;
  getSubscribers: () => Array<IMessageSubscriber>;
  delayManager?: DelayManager;
  deadLetterManager?: DeadLetterManager;
};

export class MemoryDriver implements IIrisDriver {
  private readonly logger: ILogger;
  private readonly context: unknown;
  private readonly amphora: IAmphora | undefined;
  private readonly getSubscribers: () => Array<IMessageSubscriber>;
  private readonly store: MemorySharedState;
  private readonly delayManager: DelayManager | undefined;
  private readonly deadLetterManager: DeadLetterManager | undefined;
  private _connectionState: IrisConnectionState = "disconnected";
  private readonly _stateListeners: Array<(state: IrisConnectionState) => void> = [];
  private _replyQueueActive: boolean = false;

  public constructor(options: MemoryDriverOptions, store?: MemorySharedState) {
    this.logger = options.logger.child(["MemoryDriver"]);
    this.context = options.context;
    this.amphora = options.amphora;
    this.getSubscribers = options.getSubscribers;
    this.store = store ?? createStore();
    this.delayManager = options.delayManager;
    this.deadLetterManager = options.deadLetterManager;
  }

  public async connect(): Promise<void> {
    this.setConnectionState("connecting");

    if (this.delayManager) {
      this.delayManager.start(async (entry) => {
        await dispatchToSubscribers(this.store, entry.envelope);
        await dispatchToConsumers(this.store, entry.envelope);
      });
    }

    this.setConnectionState("connected");
    this.logger.debug("Connected");
  }

  public async disconnect(): Promise<void> {
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
    this.store.replyCallbacks.clear();
    this.store.roundRobinIndexes.clear();
    this._replyQueueActive = false;
    this.setConnectionState("disconnected");
    this.logger.debug("Disconnected");
  }

  public async drain(_timeout?: number): Promise<void> {
    this.setConnectionState("draining");

    // Pause dispatching — new messages go to the store but callbacks are suppressed
    this.store.paused = true;

    // Poll inFlightCount until 0
    const timeout = _timeout ?? 5000;
    const pollInterval = 10;
    const deadline = Date.now() + timeout;

    while (this.store.inFlightCount > 0 && Date.now() < deadline) {
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, pollInterval);
        t.unref();
      });
    }

    if (this.store.inFlightCount > 0) {
      this.logger.warn("Drain timeout reached with in-flight consumers remaining", {
        inFlightCount: this.store.inFlightCount,
        timeoutMs: timeout,
      });
    }

    // Resume dispatching
    this.store.paused = false;

    this.setConnectionState("connected");
    this.logger.debug("Drained");
  }

  public async ping(): Promise<boolean> {
    return this._connectionState === "connected";
  }

  public async reset(): Promise<void> {
    this.store.subscriptions.length = 0;
    this.store.consumers.length = 0;
    this.store.rpcHandlers.length = 0;
    this.store.replyCallbacks.clear();
    this.store.roundRobinIndexes.clear();

    for (const timer of this.store.timers) {
      clearTimeout(timer);
    }
    this.store.timers.clear();

    this.store.pendingRejects.clear();
    this.store.inFlightCount = 0;

    this.logger.debug("Reset");
  }

  public async setup(_messages: Array<Constructor<IMessage>>): Promise<void> {
    this.logger.debug("Setup (no-op for memory driver)");
  }

  public getConnectionState(): IrisConnectionState {
    return this._connectionState;
  }

  public onConnectionStateChange(callback: (state: IrisConnectionState) => void): void {
    this._stateListeners.push(callback);
  }

  public createPublisher<M extends IMessage>(target: Constructor<M>): IIrisPublisher<M> {
    return new MemoryPublisher<M>({
      target,
      logger: this.logger,
      context: this.context,
      amphora: this.amphora,
      getSubscribers: this.getSubscribers,
      store: this.store,
      delayManager: this.delayManager,
    });
  }

  public createMessageBus<M extends IMessage>(
    target: Constructor<M>,
  ): IIrisMessageBus<M> {
    return new MemoryMessageBus<M>({
      target,
      logger: this.logger,
      context: this.context,
      amphora: this.amphora,
      getSubscribers: this.getSubscribers,
      store: this.store,
      delayManager: this.delayManager,
      deadLetterManager: this.deadLetterManager,
    });
  }

  public createWorkerQueue<M extends IMessage>(
    target: Constructor<M>,
  ): IIrisWorkerQueue<M> {
    return new MemoryWorkerQueue<M>({
      target,
      logger: this.logger,
      context: this.context,
      amphora: this.amphora,
      getSubscribers: this.getSubscribers,
      store: this.store,
      delayManager: this.delayManager,
      deadLetterManager: this.deadLetterManager,
    });
  }

  public createStreamProcessor(): IIrisStreamProcessor {
    return new MemoryStreamProcessor({
      state: this.store,
      logger: this.logger,
      context: this.context,
      amphora: this.amphora,
    });
  }

  public createRpcClient<Req extends IMessage, Res extends IMessage>(
    requestTarget: Constructor<Req>,
    responseTarget: Constructor<Res>,
  ): MemoryRpcClient<Req, Res> {
    return new MemoryRpcClient({
      store: this.store,
      logger: this.logger,
      requestTarget,
      responseTarget,
      context: this.context,
      amphora: this.amphora,
    });
  }

  public createRpcServer<Req extends IMessage, Res extends IMessage>(
    requestTarget: Constructor<Req>,
    responseTarget: Constructor<Res>,
  ): MemoryRpcServer<Req, Res> {
    return new MemoryRpcServer({
      store: this.store,
      logger: this.logger,
      requestTarget,
      responseTarget,
      context: this.context,
      amphora: this.amphora,
    });
  }

  public async setupReplyQueue(): Promise<void> {
    this._replyQueueActive = true;
    this.logger.debug("Reply queue active");
  }

  public async teardownReplyQueue(): Promise<void> {
    this._replyQueueActive = false;
    this.logger.debug("Reply queue inactive");
  }

  public cloneWithGetters(getSubscribers: () => Array<IMessageSubscriber>): IIrisDriver {
    return new MemoryDriver(
      {
        logger: this.logger,
        context: this.context,
        amphora: this.amphora,
        getSubscribers,
        delayManager: this.delayManager,
        deadLetterManager: this.deadLetterManager,
      },
      this.store,
    );
  }

  public async getDeadLetters(topic?: string): Promise<Array<DeadLetterEntry>> {
    if (!this.deadLetterManager) return [];
    return this.deadLetterManager.list(topic ? { topic } : undefined);
  }

  public get connected(): boolean {
    return this._connectionState === "connected" || this._connectionState === "draining";
  }

  public get replyQueueActive(): boolean {
    return this._replyQueueActive;
  }

  private setConnectionState(state: IrisConnectionState): void {
    this._connectionState = state;
    for (const listener of this._stateListeners) {
      try {
        listener(state);
      } catch (error) {
        this.logger.error("State listener threw an exception", {
          state,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}
