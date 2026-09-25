import { Event } from "@lindorm/hermes";

@Event()
export class FundsWithdrawn {
  constructor(readonly amount: number) {}
}
