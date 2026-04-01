import { Event } from "@lindorm/hermes";

@Event()
export class FundsWithdrawn {
  public constructor(public readonly amount: number) {}
}
