import { Event } from "../../../decorators/index.js";

@Event()
export class FundsDeposited_V1 {
  public constructor(public readonly amount: number) {}
}
