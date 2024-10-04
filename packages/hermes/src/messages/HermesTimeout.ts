import { Dict } from "@lindorm/types";
import { IHermesMessage } from "../interfaces";
import { HermesMessageOptions } from "../types";
import { HermesMessage } from "./HermesMessage";

export class HermesTimeout<D extends Dict = Dict>
  extends HermesMessage<D>
  implements IHermesMessage<D>
{
  public constructor(options: HermesMessageOptions<D>, causation?: IHermesMessage) {
    super({ ...options, mandatory: true }, causation);
  }
}
