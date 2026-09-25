import { Event } from "@lindorm/hermes";

@Event()
export class FundsDeposited_V1 {
  constructor(readonly amount: number) {}
}
