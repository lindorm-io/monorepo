import { IMessage, ISubscription, MessageBusOptions } from "../types";
import { MessageBusBase } from "../infrastructure";

export class TestMessageBus extends MessageBusBase<IMessage, ISubscription> {
  public constructor(options: MessageBusOptions) {
    super(options);
  }

  protected createMessage(message: IMessage): any {
    return message;
  }

  protected async validateMessage(message: IMessage): Promise<void> {
    return;
  }

  protected async validateSubscription(subscription: ISubscription): Promise<void> {
    return;
  }
}
