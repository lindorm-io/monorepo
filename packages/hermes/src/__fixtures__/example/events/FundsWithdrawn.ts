import { Event } from "../../../decorators/index.js";

@Event()
export class FundsWithdrawn {
  public constructor(public readonly amount: number) {}
}
