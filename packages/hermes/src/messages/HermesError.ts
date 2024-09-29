import { IHermesMessage } from "../interfaces";
import { HermesErrorData, HermesMessageOptions } from "../types";
import { HermesMessageBase } from "./HermesMessageBase";

export class HermesError
  extends HermesMessageBase<HermesErrorData>
  implements IHermesMessage<HermesErrorData>
{
  public constructor(
    options: HermesMessageOptions<HermesErrorData>,
    causation?: IHermesMessage,
  ) {
    super(options, causation);
  }
}
