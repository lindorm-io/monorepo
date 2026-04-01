import { Event } from "@lindorm/hermes";

@Event()
export class FundsDeposited_V1 {
  public constructor(public readonly amount: number) {}
}
