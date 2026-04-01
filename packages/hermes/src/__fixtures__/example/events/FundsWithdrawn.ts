import { Event } from "../../../decorators";

@Event()
export class FundsWithdrawn {
  public constructor(public readonly amount: number) {}
}
