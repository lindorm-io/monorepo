import { z } from "zod";
import { Command } from "../../../decorators";

@Command()
export class DepositFunds {
  public constructor(
    public readonly amount: number,
    public readonly currency: string,
  ) {}
}

export const DepositFundsSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().min(1),
});
