import { AbstractSteps, Inject } from "@lindorm/gherkin";
import type { EncryptedToken, SignedToken, VerifiedToken } from "../types/index.js";
import { AegisContext } from "./aegis-context.js";
import { inspectToken } from "./inspect-token.js";
import { rawBucketOf, type RawBucket, type RawPart } from "./raw-bucket.js";

@AbstractSteps()
export abstract class AegisStepsBase {
  @Inject(AegisContext) protected readonly ctx!: AegisContext;

  /** Run an act, keeping its refusal for a Then to judge. `undefined` means it refused. */
  protected async attempt<T>(act: () => Promise<T>): Promise<T | undefined> {
    try {
      return await act();
    } catch (error) {
      this.ctx.refusal = error;
      return undefined;
    }
  }

  protected refusal(): unknown {
    if (this.ctx.refusal !== undefined) return this.ctx.refusal;

    throw new Error("the act was not refused: it produced a token");
  }

  protected signed(): SignedToken {
    return this.produced(this.ctx.signed, "signed");
  }

  protected encrypted(): EncryptedToken {
    return this.produced(this.ctx.encrypted, "encrypted");
  }

  protected verified(): VerifiedToken {
    return this.produced(this.ctx.verified, "verified");
  }

  /** The named part of the last artifact, read off the bytes by the independent inspector. */
  protected raw(part: RawPart): RawBucket {
    return rawBucketOf(inspectToken(this.produced(this.ctx.token, "produced")), part);
  }

  private produced<T>(result: T | undefined, what: string): T {
    if (this.ctx.refusal !== undefined) {
      throw new Error(`the act was refused, so no token was ${what}`, {
        cause: this.ctx.refusal,
      });
    }

    if (result !== undefined) return result;

    throw new Error(`no token was ${what} in this scenario`);
  }
}
