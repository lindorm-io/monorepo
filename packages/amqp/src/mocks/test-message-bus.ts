import { IMessage, ISubscription, MessageBusOptions } from "../types";
import { MessageBusBase } from "../message-bus";

export class TestMessageBus extends MessageBusBase<IMessage, ISubscription> {
  public constructor(options: MessageBusOptions) {
    super(options);
  }

  protected createMessage(message: IMessage): any {
    return message;
  }
}
