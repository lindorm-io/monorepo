import { z } from "zod";
import { Command } from "@lindorm/hermes";

@Command()
export class WithdrawFunds {
  constructor(readonly amount: number) {}
}

export const WithdrawFundsSchema = z.object({
  amount: z.number().positive(),
});
