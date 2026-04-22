import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import type { IMessage, IMessageSubscriber } from "../../interfaces/index.js";
import type { IrisHookMeta } from "../../types/iris-hook-meta.js";
import { createDefaultIrisHookMeta } from "../../types/iris-hook-meta.js";
import type { MessageMetadata } from "../message/types/metadata.js";
import { MessageManager } from "../message/classes/MessageManager.js";
import { getMessageMetadata } from "../message/metadata/get-message-metadata.js";
import { prepareOutbound } from "../message/utils/prepare-outbound.js";
import type { OutboundPayload } from "../message/utils/prepare-outbound.js";
import { prepareInbound } from "../message/utils/prepare-inbound.js";
import type { IAmphora } from "@lindorm/amphora";

export type DriverBaseOptions<M extends IMessage> = {
  target: Constructor<M>;
  logger: ILogger;
  context?: IrisHookMeta;
  amphora?: IAmphora;
  getSubscribers: () => Array<IMessageSubscriber>;
};

export abstract class DriverBase<M extends IMessage> {
  protected readonly target: Constructor<M>;
  protected readonly metadata: MessageMetadata;
  protected readonly manager: MessageManager<M>;
  protected readonly logger: ILogger;
  protected readonly context: IrisHookMeta;
  protected readonly amphora: IAmphora | undefined;
  private readonly getSubscribers: () => Array<IMessageSubscriber>;

  protected constructor(options: DriverBaseOptions<M>, loggerLabel: string) {
    this.target = options.target;
    this.metadata = getMessageMetadata(options.target);
    const resolvedContext = options.context ?? createDefaultIrisHookMeta();
    this.manager = new MessageManager<M>({
      target: options.target,
      logger: options.logger,
      context: resolvedContext,
    });
    this.logger = options.logger.child([loggerLabel, this.metadata.message.name]);
    this.context = resolvedContext;
    this.amphora = options.amphora;
    this.getSubscribers = options.getSubscribers;
  }

  public create(options?: Partial<M>): M {
    return this.manager.create(options);
  }

  public hydrate(data: Record<string, unknown>): M {
    return this.manager.hydrate(data);
  }

  public copy(message: M): M {
    return this.manager.copy(message);
  }

  public validate(message: M): void {
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

    return prepareOutbound(message, this.metadata, this.amphora);
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
    const data = await prepareInbound(payload, headers, this.metadata, this.amphora);
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
