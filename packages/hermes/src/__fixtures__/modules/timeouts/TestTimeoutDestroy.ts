import { Timeout } from "../../../decorators";

@Timeout()
export class TestTimeoutDestroy {
  public constructor(public readonly input: any) {}
}
