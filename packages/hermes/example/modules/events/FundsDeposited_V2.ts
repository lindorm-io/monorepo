import { Event } from "@lindorm/hermes";

@Event()
export class FundsDeposited_V2 {
  public constructor(
    public readonly amount: number,
    public readonly currency: string,
  ) {}
}
