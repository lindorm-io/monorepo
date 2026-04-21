import { Event } from "../../../decorators/index.js";

@Event()
export class FundsDeposited_V2 {
  public constructor(
    public readonly amount: number,
    public readonly currency: string,
  ) {}
}
