import { z } from "zod";
import { Command } from "../../../decorators/index.js";

@Command()
export class OpenAccount {
  public constructor(
    public readonly ownerName: string,
    public readonly currency: string,
    public readonly initialDeposit: number,
  ) {}
}

export const OpenAccountSchema = z.object({
  ownerName: z.string().min(1),
  currency: z.string().length(3),
  initialDeposit: z.number().nonnegative(),
});
