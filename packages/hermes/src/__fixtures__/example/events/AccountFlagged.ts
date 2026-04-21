import { Event } from "../../../decorators/index.js";

@Event()
export class AccountFlagged {
  public constructor(public readonly reason: string) {}
}
