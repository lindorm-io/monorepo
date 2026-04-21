import { Event } from "../../../decorators/index.js";

@Event()
export class AccountOpened {
  public constructor(
    public readonly ownerName: string,
    public readonly currency: string,
    public readonly initialBalance: number,
  ) {}
}
