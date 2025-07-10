import { Command } from "../../../decorators";

@Command()
export class TestCommandDestroy {
  public constructor(public readonly input: any) {}
}
