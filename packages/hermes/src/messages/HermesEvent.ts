import { Message } from "@lindorm/message";
import { Dict } from "@lindorm/types";
import { IHermesMessage } from "../interfaces";
import { HermesMessage } from "./HermesMessage";

@Message()
export class HermesEvent extends HermesMessage<Dict> implements IHermesMessage<Dict> {}
