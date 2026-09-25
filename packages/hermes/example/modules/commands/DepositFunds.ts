import { z } from "zod";
import { Command } from "@lindorm/hermes";

@Command()
export class DepositFunds {
  constructor(
    readonly amount: number,
    readonly currency: string,
  ) {}
}

export const DepositFundsSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().min(1),
});
