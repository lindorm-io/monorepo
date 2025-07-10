import { IMessage, Message, OnCreate } from "@lindorm/message";
import { Dict } from "@lindorm/types";
import { IHermesMessage } from "../interfaces";
import { HermesMessage } from "./HermesMessage";

@Message()
@OnCreate((message) => {
  (message as IMessage).mandatory = true;
})
export class HermesCommand<C extends Dict>
  extends HermesMessage<C>
  implements IHermesMessage<C> {}
