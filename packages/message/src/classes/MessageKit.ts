import { ILogger } from "@lindorm/logger";
import { Constructor, DeepPartial } from "@lindorm/types";
import { IMessage } from "../interfaces";
import { MessageMetadata, MetaFieldDecorator } from "../types";
import { MessageKitOptions, TopicNameOptions } from "../types/message-kit";
import {
  defaultCreateMessage,
  defaultGenerateMessage,
  defaultValidateMessage,
  getTopicName,
  globalMessageMetadata,
} from "../utils";

export class MessageKit<
  M extends IMessage = IMessage,
  O extends DeepPartial<M> = DeepPartial<M>,
  D extends MetaFieldDecorator = MetaFieldDecorator,
> {
  private readonly target: Constructor<M>;
  private readonly logger: ILogger | undefined;

  public readonly metadata: MessageMetadata<M, D>;

  public constructor(options: MessageKitOptions<M>) {
    this.target = options.target;
    this.logger = options.logger?.child(["MessageKit"]);

    this.metadata = globalMessageMetadata.get(this.target);
  }

  public create(options: O | M = {} as O): M {
    const message = defaultCreateMessage(this.target, options);

    this.logger?.silly("Created message", { message });

    return defaultGenerateMessage(this.target, message);
  }

  public copy(message: M): M {
    const copy = new this.target(message);

    this.logger?.silly("Copied message", { copy });

    return copy;
  }

  public publish(message: M): M {
    const result = defaultGenerateMessage(this.target, message);

    this.logger?.silly("Generated message", { message: result });

    return result;
  }

  public validate(message: M): void {
    defaultValidateMessage(this.target, message);

    this.logger?.silly("Validated message", { message });
  }

  public getTopicName(message: M, options: TopicNameOptions = {}): string {
    return getTopicName(this.target, message, options);
  }

  // public hooks

  public onConsume(message: M): void {
    for (const hook of this.metadata.hooks.filter((h) => h.decorator === "OnConsume")) {
      hook.callback(message);
    }
  }

  public onCreate(message: M): void {
    for (const hook of this.metadata.hooks.filter((h) => h.decorator === "OnCreate")) {
      hook.callback(message);
    }
  }

  public onPublish(message: M): void {
    for (const hook of this.metadata.hooks.filter((h) => h.decorator === "OnPublish")) {
      hook.callback(message);
    }
  }

  public onValidate(message: M): void {
    for (const hook of this.metadata.hooks.filter((h) => h.decorator === "OnValidate")) {
      hook.callback(message);
    }
  }
}
