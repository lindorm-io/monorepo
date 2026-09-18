import { AbstractSteps, Inject } from "@lindorm/gherkin";
import { expect } from "vitest";
import { AegisDomainError } from "../errors/index.js";
import type {
  DecryptedToken,
  EncryptedToken,
  SignedToken,
  VerifiedToken,
} from "../types/index.js";
import { AegisContext } from "./aegis-context.js";
import { inspectToken, type TokenInspection } from "./inspect-token.js";
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

  /** The refusal is aegis's domain error, under `code` when the sentence names one. */
  protected refusedAsADomainError(code: string | undefined): void {
    const refusal = this.refusal();

    expect(refusal).toBeInstanceOf(AegisDomainError);

    if (code === undefined) return;

    expect(refusal).toMatchObject({ code });
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

  protected decrypted(): DecryptedToken {
    return this.produced(this.ctx.decrypted, "decrypted");
  }

  /** The last artifact, whichever verb produced it. */
  protected token(): string {
    return this.produced(this.ctx.token, "produced");
  }

  /** The last artifact as the independent inspector reads it off the bytes. */
  protected inspected(): TokenInspection {
    return inspectToken(this.token());
  }

  /** The named part of the last artifact, read off the bytes by the independent inspector. */
  protected raw(part: RawPart): RawBucket {
    return rawBucketOf(this.inspected(), part);
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
