import { Message } from "./Message";
import { Data, IMessage, MessageOptions } from "../types";
import { Command } from "./Command";
import { MessageType } from "../enum";

export class DomainEvent<D extends Data = Data> extends Message<D> implements IMessage {
  public constructor(options: MessageOptions<D>, causation?: Command) {
    super(
      {
        ...options,
        type: MessageType.DOMAIN_EVENT,
      },
      causation,
    );
  }
}
