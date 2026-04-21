import { Command } from "../../../decorators/index.js";

@Command()
export class TestCommandDestroy {
  public constructor(public readonly input: string) {}
}
