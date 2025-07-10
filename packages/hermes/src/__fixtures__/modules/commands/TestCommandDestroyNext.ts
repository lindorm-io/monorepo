import { Command } from "../../../decorators";

@Command()
export class TestCommandDestroyNext {
  public constructor(public readonly input: any) {}
}
