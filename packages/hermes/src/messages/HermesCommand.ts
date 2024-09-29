import { Dict } from "@lindorm/types";
import { IHermesMessage } from "../interfaces";
import { HermesMessageOptions } from "../types";
import { HermesMessageBase } from "./HermesMessageBase";

export class HermesCommand<D extends Dict = Dict>
  extends HermesMessageBase<D>
  implements IHermesMessage<D>
{
  public constructor(options: HermesMessageOptions<D>, causation?: IHermesMessage) {
    super({ ...options, mandatory: true }, causation);
  }
}
