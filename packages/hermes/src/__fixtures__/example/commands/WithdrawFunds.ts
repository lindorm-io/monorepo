import { z } from "zod";
import { Command } from "../../../decorators/index.js";

@Command()
export class WithdrawFunds {
  public constructor(public readonly amount: number) {}
}

export const WithdrawFundsSchema = z.object({
  amount: z.number().positive(),
});
