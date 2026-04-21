import { Timeout } from "../../../decorators/index.js";

@Timeout()
export class InactivityTimeout {
  public constructor(public readonly accountId: string) {}
}
