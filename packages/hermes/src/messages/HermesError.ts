import { IHermesMessage } from "../interfaces";
import { HermesErrorData, HermesMessageOptions } from "../types";
import { HermesMessage } from "./HermesMessage";

export class HermesError
  extends HermesMessage<HermesErrorData>
  implements IHermesMessage<HermesErrorData>
{
  public constructor(
    options: HermesMessageOptions<HermesErrorData>,
    causation?: IHermesMessage,
  ) {
    super(options, causation);
  }
}
