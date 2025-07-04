import { Message } from "@lindorm/message";
import { IHermesMessage } from "../interfaces";
import { HermesErrorData } from "../types";
import { HermesMessage } from "./HermesMessage";

@Message()
export class HermesError
  extends HermesMessage<HermesErrorData>
  implements IHermesMessage<HermesErrorData> {}
