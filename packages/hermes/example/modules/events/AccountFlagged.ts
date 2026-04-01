import { Event } from "@lindorm/hermes";

@Event()
export class AccountFlagged {
  public constructor(public readonly reason: string) {}
}
