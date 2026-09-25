import { Event } from "@lindorm/hermes";

@Event()
export class FundsDeposited_V2 {
  constructor(
    readonly amount: number,
    readonly currency: string,
  ) {}
}
