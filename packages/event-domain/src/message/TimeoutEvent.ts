import { Data, IMessage, MessageOptions } from "../types";
import { Message } from "./Message";
import { MessageType } from "../enum";

export class TimeoutEvent<D extends Data = Data> extends Message<D> implements IMessage {
  public constructor(options: MessageOptions<D>, causation?: Message) {
    super(
      {
        ...options,
        mandatory: true,
        type: MessageType.TIMEOUT_EVENT,
      },
      causation,
    );
  }
}
