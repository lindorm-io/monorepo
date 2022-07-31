import { IMessage, MessageOptions, Data } from "../types";
import { Message } from "./Message";
import { MessageType } from "../enum";

export class ReplayEvent<D extends Data = Data> extends Message<D> implements IMessage {
  public constructor(options: MessageOptions<D>, causation?: Message) {
    super(
      {
        ...options,
        mandatory: true,
        type: MessageType.REPLAY_EVENT,
      },
      causation,
    );
  }
}
