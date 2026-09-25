import { Event } from "@lindorm/hermes";

@Event()
export class AccountOpened {
  constructor(
    readonly ownerName: string,
    readonly currency: string,
    readonly initialBalance: number,
  ) {}
}
