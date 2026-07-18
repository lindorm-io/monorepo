import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import type { IMessage, IMessageSubscriber } from "../../interfaces/index.js";
import type { IrisDriverType } from "../../types/index.js";
import type { IrisHookMeta } from "../../types/iris-hook-meta.js";
import { createDefaultIrisHookMeta } from "../../types/iris-hook-meta.js";
import type { MessageMetadata } from "../message/types/metadata.js";
import { MessageManager } from "../message/classes/MessageManager.js";
import { getMessageMetadata } from "../message/metadata/get-message-metadata.js";
import { prepareOutbound } from "../message/utils/prepare-outbound.js";
import type { OutboundPayload } from "../message/utils/prepare-outbound.js";
import { prepareInbound } from "../message/utils/prepare-inbound.js";
import { driverCapabilities } from "../drivers/driver-capabilities.js";
import type { MessageEncryptionContext } from "../message/types/encryption-context.js";

export type DriverBaseOptions<M extends IMessage> = {
  target: Constructor<M>;
  logger: ILogger;
  meta?: IrisHookMeta;
  encryption?: MessageEncryptionContext;
  getSubscribers: () => Array<IMessageSubscriber>;
  /**
   * The active driver type, used to resolve `IrisCapabilities` for runtime
   * capability warnings (e.g. priority no-op). Present on the publish-capable
   * bases (publisher / message-bus / worker-queue); absent where no such warning
   * applies.
   */
  driverType?: IrisDriverType;
};

export abstract class DriverBase<M extends IMessage> {
  protected readonly target: Constructor<M>;
  protected readonly metadata: MessageMetadata;
  protected readonly manager: MessageManager<M>;
  protected readonly logger: ILogger;
  protected readonly meta: IrisHookMeta;
  protected readonly encryption: MessageEncryptionContext | undefined;
  private readonly getSubscribers: () => Array<IMessageSubscriber>;
  private readonly driverType: IrisDriverType | undefined;
  private priorityWarned = false;

  protected constructor(options: DriverBaseOptions<M>, loggerLabel: string) {
    this.target = options.target;
    this.metadata = getMessageMetadata(options.target);
    const resolvedMeta = options.meta ?? createDefaultIrisHookMeta();
    this.manager = new MessageManager<M>({
      target: options.target,
      logger: options.logger,
      meta: resolvedMeta,
    });
    this.logger = options.logger.child([loggerLabel, this.metadata.message.name]);
    this.meta = resolvedMeta;
    this.encryption = options.encryption;
    this.getSubscribers = options.getSubscribers;
    this.driverType = options.driverType;
  }

  /**
   * Warn — once per instance — when a message is published with a non-default
   * priority on a driver that does not honour priority ordering. Without this the
   * priority is a silent no-op: the consumer receives FIFO order and never learns
   * the driver ignored it. Called from the shared publish path once per batch.
   */
  warnPriorityUnsupportedOnce(priority: number): void {
    if (priority === 0 || this.priorityWarned || !this.driverType) return;
    if (driverCapabilities(this.driverType).priority) return;

    this.priorityWarned = true;
    this.logger.warn(
      `priority is set but the ${this.driverType} driver does not honor message priority; delivery order is unaffected`,
      { driver: this.driverType, priority },
    );
  }

  create(options?: Partial<M>): M {
    return this.manager.create(options);
  }

  hydrate(data: Record<string, unknown>): M {
    return this.manager.hydrate(data);
  }

  copy(message: M): M {
    return this.manager.copy(message);
  }

  validate(message: M): void {
    this.manager.validate(message);
  }

  protected async prepareForPublish(message: M): Promise<OutboundPayload> {
    this.manager.validate(message);
    await this.manager.beforePublish(message);
    for (const sub of this.getSubscribers()) {
      try {
        await sub.beforePublish?.(message);
      } catch (hookError) {
        this.logger.error("Subscriber beforePublish hook failed", { error: hookError });
      }
    }

    return prepareOutbound(message, this.metadata, this.encryption);
  }

  protected async completePublish(message: M): Promise<void> {
    await this.manager.afterPublish(message);
    for (const sub of this.getSubscribers()) {
      try {
        await sub.afterPublish?.(message);
      } catch (hookError) {
        this.logger.error("Subscriber afterPublish hook failed", { error: hookError });
      }
    }
  }

  protected async prepareForConsume(
    payload: Buffer | string,
    headers: Record<string, string>,
  ): Promise<M> {
    const data = await prepareInbound(payload, headers, this.metadata, this.encryption);
    const message = this.manager.hydrate(data);

    await this.manager.beforeConsume(message);
    for (const sub of this.getSubscribers()) {
      try {
        await sub.beforeConsume?.(message);
      } catch (hookError) {
        this.logger.error("Subscriber beforeConsume hook failed", { error: hookError });
      }
    }

    return message;
  }

  protected async afterConsumeSuccess(message: M): Promise<void> {
    await this.manager.afterConsume(message);
    for (const sub of this.getSubscribers()) {
      try {
        await sub.afterConsume?.(message);
      } catch (hookError) {
        this.logger.error("Subscriber afterConsume hook failed", { error: hookError });
      }
    }
  }

  protected async onConsumeError(error: Error, message: M): Promise<void> {
    await this.manager.onConsumeError(error, message);
    for (const sub of this.getSubscribers()) {
      try {
        await sub.onConsumeError?.(error, message);
      } catch (hookError) {
        this.logger.error("Subscriber onConsumeError hook failed", { error: hookError });
      }
    }
  }
}
