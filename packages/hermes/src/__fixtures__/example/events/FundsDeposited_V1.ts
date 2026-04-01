import { Event } from "../../../decorators";

@Event()
export class FundsDeposited_V1 {
  public constructor(public readonly amount: number) {}
}
