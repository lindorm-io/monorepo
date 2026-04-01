import { Timeout } from "../../../decorators";

@Timeout()
export class InactivityTimeout {
  public constructor(public readonly accountId: string) {}
}
