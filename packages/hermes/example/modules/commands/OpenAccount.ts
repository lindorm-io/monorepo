import { z } from "zod";
import { Command } from "@lindorm/hermes";

@Command()
export class OpenAccount {
  constructor(
    readonly ownerName: string,
    readonly currency: string,
    readonly initialDeposit: number,
  ) {}
}

export const OpenAccountSchema = z.object({
  ownerName: z.string().min(1),
  currency: z.string().length(3),
  initialDeposit: z.number().nonnegative(),
});
