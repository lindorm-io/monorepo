import { Message } from "@lindorm/message";
import { Dict } from "@lindorm/types";
import { IHermesMessage } from "../interfaces";
import { HermesMessage } from "./HermesMessage";

@Message()
export class HermesEvent<E = Dict>
  extends HermesMessage<E>
  implements IHermesMessage<E> {}
