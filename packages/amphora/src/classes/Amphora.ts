import { isArray, isUrlLike } from "@lindorm/is";
import { type IKryptos, KryptosKit } from "@lindorm/kryptos";
import { AmphoraError } from "../errors/index.js";
import type { IAmphora, IAmphoraExternal, IAmphoraIdp } from "../interfaces/index.js";
import type {
  AmphoraInternalConfig,
  AmphoraJwks,
  AmphoraCondition,
  AmphoraSettings,
} from "../types/index.js";
import { AmphoraExternal } from "../internal/classes/AmphoraExternal.js";
import { AmphoraIdp } from "../internal/classes/AmphoraIdp.js";
import { AmphoraState } from "../internal/classes/AmphoraState.js";

export class Amphora implements IAmphora {
  readonly external: IAmphoraExternal;
  readonly idp: IAmphoraIdp;

  private readonly state: AmphoraState;

  constructor(options: AmphoraSettings) {
    this.state = new AmphoraState(options);

    this.external = new AmphoraExternal(this.state);
    this.idp = new AmphoraIdp(this.state);

    if (this.state.issuer && !isUrlLike(this.state.issuer)) {
      throw new AmphoraError("Issuer must be a valid URL", {
        code: "invalid_issuer_url",
        data: { issuer: this.state.issuer },
        title: "Invalid Issuer URL",
        details: `The configured issuer "${this.state.issuer as string}" is not a valid URL. Provide a fully-qualified URL such as https://example.com.`,
      });
    }
  }

  // public getters

  // The service's OWN identity, derived from the `internal.issuer` setting —
  // minimal (it IS the issuer, it never discovers itself), and SINGULAR: a
  // service has one identity or none. This is the ONE reader of that setting;
  // the issuer is deliberately not also exposed bare, because `internal` is what
  // names the scope it belongs to. The other two scopes live on
  // `external.issuers()` / `idp.config()`.
  get internal(): AmphoraInternalConfig | null {
    if (!this.state.issuer) return null;

    return {
      issuer: this.state.issuer,
      jwksUri: new URL("/.well-known/jwks.json", this.state.issuer).toString(),
    };
  }

  get jwks(): AmphoraJwks {
    if (!this.state.issuer) {
      throw new AmphoraError("Issuer is required to get JWKS", {
        code: "issuer_required_for_jwks",
        title: "Issuer Required For JWKS",
        details:
          "The amphora `issuer` is what the published keys are signed under. If your server signs tokens, it must declare one.",
      });
    }

    return { keys: [...this.state.jwks] };
  }

  get vault(): Array<IKryptos> {
    return [...this.state.vault];
  }

  // public setup

  async setup(): Promise<void> {
    if (this.state.isSetup) return;
    if (this.state.setupPromise) return this.state.setupPromise;

    this.state.setupPromise = (async (): Promise<void> => {
      await this.refresh();
      this.state.isSetup = true;
    })();

    try {
      await this.state.setupPromise;
    } finally {
      this.state.setupPromise = null;
    }
  }

  // public methods

  add(kryptos: Array<IKryptos> | IKryptos): void {
    this.state.addInternalKeys(isArray(kryptos) ? kryptos : [kryptos]);
  }

  env(keys: Array<string> | string): void {
    const array = isArray(keys) ? keys : [keys];

    const result: Array<IKryptos> = [];

    for (const key of array) {
      const kryptos = KryptosKit.env.import(key);

      // Env-imported keys are our own (`internal: true`) and feed the JWKS when
      // public + `publish: true` — an issuer that differs from this Amphora's own
      // issuer would never be served, which is almost certainly a config error.
      if (this.state.issuer && kryptos.issuer && kryptos.issuer !== this.state.issuer) {
        this.state.logger.warn("Env-imported key issuer differs from amphora issuer", {
          expected: this.state.issuer,
          actual: kryptos.issuer,
          kid: kryptos.id,
        });
      }

      result.push(kryptos);
    }

    this.add(result);
  }

  async filter(condition: AmphoraCondition): Promise<Array<IKryptos>> {
    if (!this.state.isSetup && this.state.hasExternal) {
      await this.setup();
    }

    const filtered = this.state.filteredKeys(condition);

    if (filtered.length && !this.state.isStaleFor(condition)) {
      this.state.markAccessed(filtered);
      return filtered;
    }

    if (this.state.hasExternal) await this.state.refreshFor(condition);

    const refreshed = this.state.filteredKeys(condition);
    this.state.markAccessed(refreshed);
    return refreshed;
  }

  filterSync(condition: AmphoraCondition): Array<IKryptos> {
    this.assertSetupForSync();

    const filtered = this.state.filteredKeys(condition);
    this.state.markAccessed(filtered);
    return filtered;
  }

  async find(condition: AmphoraCondition): Promise<IKryptos> {
    const [key] = await this.filter(condition);
    if (key) return key;

    throw new AmphoraError("Kryptos not found using query after refresh", {
      code: "kryptos_not_found_by_query_after_refresh",
      data: {
        queryKeys: Object.keys(condition),
        totalKeys: this.state.vault.length,
        activeKeys: this.state.vault.filter((i) => i.isActive).length,
      },
      title: "Kryptos Not Found By Query After Refresh",
      details: `No active Kryptos matched the query (${Object.keys(condition).join(", ")}) even after refreshing external providers. Verify the query and that a matching key exists.`,
    });
  }

  async findById(id: string): Promise<IKryptos> {
    const existing = this.state.findByIdMostRecent(id);
    if (existing) {
      this.state.markAccessed([existing]);
      return existing;
    }

    // No issuer to target — fall back to refreshing EVERYTHING fetched. This is
    // the expensive path, reinforcing "resolve a kid via find({ id, issuer })".
    if (this.state.hasExternal) {
      await this.refresh();

      const refreshed = this.state.findByIdMostRecent(id);
      if (refreshed) {
        this.state.markAccessed([refreshed]);
        return refreshed;
      }
    }

    throw new AmphoraError("Kryptos not found by id", {
      code: "kryptos_not_found_by_id",
      data: { id, totalKeys: this.state.vault.length },
      title: "Kryptos Not Found By ID",
      details: `No Kryptos with id "${id}" exists in the vault, even after refreshing external providers. Confirm the id is correct and the key is available.`,
    });
  }

  findByIdSync(id: string): IKryptos {
    this.assertSetupForSync();

    const existing = this.state.findByIdMostRecent(id);
    if (existing) {
      this.state.markAccessed([existing]);
      return existing;
    }

    throw new AmphoraError("Kryptos not found by id", {
      code: "kryptos_not_found_by_id_sync",
      data: { id, totalKeys: this.state.vault.length },
      title: "Kryptos Not Found By ID (Sync)",
      details: `No Kryptos with id "${id}" exists in the vault. Synchronous lookup does not refresh external providers, so the key must already be loaded.`,
    });
  }

  findSync(condition: AmphoraCondition): IKryptos {
    this.assertSetupForSync();

    const [key] = this.state.filteredKeys(condition);
    if (key) {
      this.state.markAccessed([key]);
      return key;
    }

    throw new AmphoraError("Kryptos not found using query (sync, no refresh)", {
      code: "kryptos_not_found_by_query_sync",
      data: {
        queryKeys: Object.keys(condition),
        totalKeys: this.state.vault.length,
        activeKeys: this.state.vault.filter((i) => i.isActive).length,
      },
      title: "Kryptos Not Found By Query (Sync)",
      details: `No active Kryptos matched the query (${Object.keys(condition).join(", ")}). Synchronous lookup does not refresh providers, so a matching key must already be loaded.`,
    });
  }

  refresh(): Promise<void> {
    return this.state.refresh();
  }

  // The question is never "does key_ops list this operation?" but "does the vault
  // hold the HALF the operation needs?" — which is what `hasPrivateKey` answers.
  // `canEncrypt` asks for `use: "enc"` alone: an oct key has no public half, so
  // demanding `hasPublicKey` would exclude every dir / A*KW / PBES2 key.
  // `hasPrivateKey` on the decrypt side is what excludes remotely-fetched keys —
  // a JWKS only ever yields public halves.

  canEncrypt(): boolean {
    return this.state.filteredKeys({ use: "enc" }).length > 0;
  }

  canDecrypt(): boolean {
    return this.state.filteredKeys({ use: "enc", hasPrivateKey: true }).length > 0;
  }

  canSign(): boolean {
    return this.state.filteredKeys({ use: "sig", hasPrivateKey: true }).length > 0;
  }

  canVerify(): boolean {
    return this.state.filteredKeys({ use: "sig" }).length > 0;
  }

  // private methods

  private assertSetupForSync(): void {
    if (this.state.isSetup || !this.state.hasExternal) return;

    throw new AmphoraError(
      this.state.setupPromise
        ? "setup() is in progress; await setup() before using sync methods"
        : "setup() must be called before using sync methods with external providers",
      {
        code: this.state.setupPromise ? "setup_in_progress" : "setup_required_for_sync",
        data: { externalProviders: this.state.allEntries.length },
        title: this.state.setupPromise ? "Setup In Progress" : "Setup Required For Sync",
        details: this.state.setupPromise
          ? "Amphora setup() is currently running; await setup() to finish before calling synchronous methods."
          : "External providers are configured, so setup() must complete before synchronous methods can be used. Call and await setup() first.",
      },
    );
  }
}
