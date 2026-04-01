import { Event } from "../../../decorators";

@Event()
export class AccountFlagged {
  public constructor(public readonly reason: string) {}
}
