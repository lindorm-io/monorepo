import { isString } from "@lindorm/is";
import { Matcher } from "@lindorm/match";
import type { Conduit } from "@lindorm/conduit";
import { type IKryptos, KryptosKit, type LindormJwk } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { computeDelay } from "@lindorm/retry";
import type { Environment } from "@lindorm/types";
import { EXTERNAL_RETRY_DELAY } from "../../constants/external-retry-delay.js";
import { AmphoraError } from "../../errors/index.js";
import type {
  AmphoraCondition,
  AmphoraExternalSettings,
  AmphoraSettings,
} from "../../types/index.js";
import type { ExternalEntry } from "../types/external-entry.js";
import { createExternalConduit } from "../utils/create-external-conduit.js";
import { deriveInternalJwksUri } from "../utils/derive-internal-jwks-uri.js";
import { fetchExternalJwks } from "../utils/fetch-external-jwks.js";
import { isEnvironment } from "../utils/is-environment.js";
import { resolveExternalConfig } from "../utils/resolve-external-config.js";
import { seedExternalConfig } from "../utils/seed-external-config.js";
import { seedIdpConfig } from "../utils/seed-idp-config.js";

/**
 * The ONE shared internal state behind an Amphora — a single Conduit, a single
 * logger, the single key vault — held by the class and by BOTH the `external`
 * and `idp` facets. Provenance (internal vs external vs idp) governs how keys
 * ENTER and REFRESH here; it never partitions the vault, so the class's unified
 * find/filter searches every key regardless of how it arrived.
 */
export class AmphoraState {
  readonly conduit: Conduit;
  readonly logger: ILogger;
  readonly issuer: string | null;
  readonly environment: Environment | null;
  readonly maxExternalKeys: number;
  readonly maxIssuers: number;
  readonly refreshInterval: number;

  vault: Array<IKryptos> = [];
  externalEntries: Array<ExternalEntry> = [];
  idpEntry: ExternalEntry | null = null;

  isSetup = false;
  setupPromise: Promise<void> | null = null;
  refreshPromise: Promise<void> | null = null;

  private _jwks: Array<LindormJwk> = [];
  private readonly issuerRefreshPromises = new Map<string, Promise<void>>();
  private readonly issuerRegisterPromises = new Map<string, Promise<void>>();

  constructor(options: AmphoraSettings) {
    this.logger = options.logger.child(["Amphora"]);
    this.conduit = createExternalConduit(options, this.logger);

    this.issuer = options.internal?.issuer ?? null;
    this.environment = options.environment ?? null;
    this.maxExternalKeys = options.maxExternalKeys ?? 100;
    this.maxIssuers = options.maxIssuers ?? 1000;
    this.refreshInterval = options.refreshInterval ?? 300_000;

    if (options.idp) this.idpEntry = seedIdpConfig(options.idp);
    this.externalEntries = (options.external ?? []).map((input) =>
      seedExternalConfig(input, "declared"),
    );
  }

  // getters

  get jwks(): Array<LindormJwk> {
    return this._jwks;
  }

  get hasExternal(): boolean {
    return this.externalEntries.length > 0 || this.idpEntry !== null;
  }

  get allEntries(): Array<ExternalEntry> {
    return this.idpEntry
      ? [...this.externalEntries, this.idpEntry]
      : [...this.externalEntries];
  }

  // The entries the SCHEDULED sweep owns — the operator's standing declarations
  // (constructor `external` + the idp), never the request-registered population.
  // This is the one place that split is expressed; `refreshAll` sweeps exactly
  // this set, and unscoped staleness asks about exactly this set, because asking
  // whether something is stale that the ensuing refresh will not touch is how a
  // single entry turns every unscoped lookup into a network sweep.
  get declaredEntries(): Array<ExternalEntry> {
    return this.allEntries.filter((entry) => entry.origin === "declared");
  }

  // vault selection

  // Every ACTIVE key matching the condition, newest first, with NO publish gate.
  // This is the raw answer to "does the vault HOLD such a key?", which is a
  // different question from "which key do we hand out?" — `publish` describes
  // what belongs in our JWKS, not what we are able to do. Capability probes
  // (`canSign` / `canDecrypt` / …) ask the former, so they read from here;
  // `findByIdExact` is unfiltered for the same reason.
  matchedKeys(condition: AmphoraCondition): Array<IKryptos> {
    const active = this.vault.filter((i) => i.isActive);

    return Matcher.filter<IKryptos>(active, condition).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  // SELECTION — `matchedKeys` plus the publish gate. `publish` gates selection,
  // but it means "belongs in OUR published JWKS" — and an EXTERNAL key
  // (`internal: false`) never does. So the default gate hides only INTERNAL
  // unpublished keys — the KEK / CA / cookie / session hazard. A caller that
  // NAMES `publish` opts out of the default gate entirely.
  //
  // ⚠ "NAMES it" is `!== undefined`, never `"publish" in condition`. This gate
  // INSPECTS the condition to pick a policy rather than evaluating it, so it has
  // to read the same meaning the matcher does — and `undefined` ≡ absent there,
  // by ruling. Key presence disagreed: `{ publish: undefined }` opted OUT of the
  // gate while constraining nothing, so a caller who asked for published keys
  // was handed the KEK / CA / cookie key instead — and `find` takes `[0]` of a
  // newest-first sort, so it got whichever internal key was newest. Amphora's
  // public boundary strips such keys before they reach here; writing the test
  // this way is what makes the gate correct on its own terms rather than by a
  // caller's courtesy.
  filteredKeys(condition: AmphoraCondition): Array<IKryptos> {
    const matched = this.matchedKeys(condition);

    return condition.publish !== undefined
      ? matched
      : matched.filter((i) => !i.internal || i.publish);
  }

  // Unified, UNFILTERED lookup by id across the whole vault — EXACT MATCH, and
  // scoped to one issuer when the caller knows it.
  //
  // ⚠ Deliberately NOT routed through `matchedKeys`/`filteredKeys`: those apply
  // the `isActive` filter and the publish gate, and `findById` exists precisely
  // to bypass both — a token signed by a since-expired key must still verify
  // (the clock is enforced by the caller's floor, e.g. `VERIFY_FLOOR`'s
  // `isPending: false`, not by selection).
  //
  // kid uniqueness is PER ISSUER, so an id can collide across issuers. An
  // UNSCOPED lookup that hits a collision THROWS: it has nothing to decide with,
  // and picking the "most recent" let a registered issuer choose the tiebreak —
  // `createdAt` comes off the fetched JWK's own `iat`, so a peer could publish a
  // colliding kid with a large `iat` and have its key answer for someone else's.
  findByIdExact(id: string, issuer?: string): IKryptos | undefined {
    const matches = this.vault.filter(
      (i) => i.id === id && (issuer === undefined || i.issuer === issuer),
    );

    if (matches.length === 0) return undefined;
    if (matches.length === 1) return matches[0];

    const issuers = matches.map((m) => m.issuer);

    throw new AmphoraError("Ambiguous Kryptos id", {
      code: "kryptos_ambiguous_id",
      data: { id, issuer: issuer ?? null, count: matches.length, issuers },
      title: "Ambiguous Kryptos ID",
      details: `The id "${id}" matches ${matches.length} keys (issuers: ${issuers.join(", ")}). Key ids are unique per issuer, so a bare id cannot identify one of them — name the issuer the key belongs to.`,
    });
  }

  // LRU bookkeeping — bump the last-ACCESS time of every EXTERNAL issuer whose
  // key was just RETURNED to a caller (find / filter hit). This is the signal
  // `maxIssuers` eviction ranks by. The idp is deliberately not tracked: it is
  // exempt from the cap, so its recency never matters. Capability PROBES
  // (`canSign` etc.) go straight to `matchedKeys` and never reach here, so a
  // probe does not count as use.
  markAccessed(keys: Array<IKryptos>): void {
    if (keys.length === 0 || this.externalEntries.length === 0) return;

    const now = new Date();

    for (const key of keys) {
      if (key.internal || !key.issuer) continue;

      const entry = this.externalEntries.find(
        (item) => item.issuer === key.issuer || item.input.issuer === key.issuer,
      );
      if (entry) entry.lastAccess = now;
    }
  }

  // staleness — per issuer when the condition names one, else across the entries
  // an unscoped refresh would actually reach.
  //
  // ⚠ The unscoped arm reads `declaredEntries`, not `allEntries`: an unscoped
  // refresh routes to `refreshAll`, which is declared-only, so a registered entry
  // counted here would report stale forever and make every unscoped lookup pay
  // for a sweep that cannot clear it. A registered issuer's freshness is the
  // SCOPED path's business — `find({ id, issuer })` — which is how every consumer
  // of dynamic registration reads such a key anyway.
  isStaleFor(condition: AmphoraCondition): boolean {
    const issuer = condition.issuer;

    if (isString(issuer)) {
      const entry = this.findEntry(issuer);
      if (!entry) return false;
      return this.entryStale(entry);
    }

    return this.declaredEntries.some((entry) => this.entryStale(entry));
  }

  // ⚠ Backoff gates the SPECULATIVE refetch only — a MISS never routes through
  // here (`Amphora.findById` and the empty-result arm of `Amphora.filter` call
  // `refreshFor` with no staleness check), so a client that fixes its endpoint
  // and rotates a kid is served immediately rather than locked out for the
  // backoff window.
  //
  // The `retryAfter` line is also what stops `!lastRefresh` being PERMANENT. On
  // its own that branch made an issuer that has never succeeded eternally stale,
  // and — through the unscoped arm above — made every unscoped lookup sweep every
  // issuer, forever, with no clock movement.
  private entryStale(entry: ExternalEntry): boolean {
    if (entry.retryAfter && Date.now() < entry.retryAfter.getTime()) return false;
    if (!entry.lastRefresh) return true;
    return Date.now() - entry.lastRefresh.getTime() > this.refreshInterval;
  }

  // Record a failed load: one more consecutive failure, and the instant before
  // which no speculative refetch may happen. The ONLY writer of the retry pair,
  // so the whole backoff policy is these five lines.
  private scheduleRetry(entry: ExternalEntry): void {
    entry.failureCount += 1;
    entry.retryAfter = new Date(
      Date.now() +
        computeDelay(entry.failureCount, {
          ...EXTERNAL_RETRY_DELAY,
          delay: this.refreshInterval,
        }),
    );
  }

  // Record a failed load — the retry stamp AND the log, in that order and in ONE
  // place, so a caller cannot report a failure without also backing it off (or
  // log a first failure that the stamp has not happened for yet).
  //
  // The level splits by PROVENANCE (D5). An operator's DECLARED peer going down
  // is a dependency failing and is exactly what `warn` is for — once, on the
  // transition into failure; the repeats say nothing new and drop to `debug`
  // carrying the count and the next attempt time. A REGISTERED client endpoint
  // going down is per-event churn at the size of the client population, where a
  // warn stream is unreadable — which is how the bugs this rubric replaces stayed
  // hidden — so it is `debug` throughout.
  private recordLoadFailure(entry: ExternalEntry, message: string, error: unknown): void {
    this.scheduleRetry(entry);

    const data = {
      error,
      issuer: entry.issuer ?? entry.input.issuer ?? null,
      origin: entry.origin,
      failureCount: entry.failureCount,
      retryAfter: entry.retryAfter,
    };

    if (entry.origin === "declared" && entry.failureCount === 1) {
      this.logger.warn(message, data);
      return;
    }

    this.logger.debug(message, data);
  }

  // The other half of the rubric: the transition OUT of failure. `info` for a
  // declared peer (a dependency an operator was told about coming back is a
  // significant, infrequent event), `debug` for a registered one for the same
  // volume reason. Silent when the entry was never failing — the ordinary
  // refresh is not news.
  private logRecovery(entry: ExternalEntry): void {
    const data = {
      issuer: entry.issuer ?? entry.input.issuer ?? null,
      origin: entry.origin,
      failureCount: entry.failureCount,
    };

    if (entry.origin === "declared") {
      this.logger.info("External issuer recovered", data);
      return;
    }

    this.logger.debug("External issuer recovered", data);
  }

  findEntry(issuer: string): ExternalEntry | undefined {
    return this.allEntries.find(
      (entry) => entry.issuer === issuer || entry.input.issuer === issuer,
    );
  }

  // The idp's resolved (or declared) issuer, if an idp is set.
  get idpIssuer(): string | null {
    if (!this.idpEntry) return null;
    return this.idpEntry.issuer ?? this.idpEntry.input.issuer ?? null;
  }

  // An issuer belongs to AT MOST one scope — it cannot be both the upstream `idp`
  // AND a peer `external` provider (one party, one role). Enforcing this keeps
  // issuer-scoped eviction unambiguous (evict-by-issuer never crosses scopes).
  // Called at REGISTRATION (input issuer) and at RESOLUTION (a discovery-derived
  // issuer, excluding the entry being resolved via `self`).
  assertIssuerScopeFree(
    issuer: string | null | undefined,
    scope: "external" | "idp",
    self?: ExternalEntry,
  ): void {
    if (!issuer) return;

    const holds = (entry: ExternalEntry): boolean =>
      entry !== self && (entry.issuer ?? entry.input.issuer) === issuer;

    const clash =
      scope === "idp"
        ? this.externalEntries.some(holds)
        : this.idpEntry !== null && holds(this.idpEntry);

    if (clash) {
      throw new AmphoraError("Issuer is already registered in the other scope", {
        code: "issuer_scope_conflict",
        data: { issuer, scope },
        title: "Issuer Scope Conflict",
        details: `The issuer "${issuer}" is already registered as ${
          scope === "idp" ? "an external provider" : "the idp"
        }. An issuer belongs to exactly one scope — the idp OR external — not both.`,
      });
    }
  }

  // vault mutation

  // Cross-environment guard: reject a key whose leaf certificate declares an
  // Environment OU that differs from this Amphora's. Keys without a certificate,
  // or whose leaf OU is absent or a foreign (non-Environment) value, are
  // unrestricted.
  assertEnvironment(item: IKryptos): void {
    if (!this.environment || !item.hasCertificate) return;

    const ou = item.parseCertificate()?.subject.organizationalUnit;
    if (!isEnvironment(ou) || ou === this.environment) return;

    throw new AmphoraError("Kryptos certificate environment mismatch", {
      code: "environment_mismatch",
      data: { id: item.id, expected: this.environment, actual: ou },
      title: "Environment Mismatch",
      details: `The Kryptos "${item.id}" carries a certificate for the "${ou}" environment, which does not match this Amphora's "${this.environment}" environment.`,
    });
  }

  // Add OUR OWN keys (from `add` / `env`): stamp issuer/jwksUri from the amphora
  // issuer, require issuer, reject expired, enforce the environment guard.
  addInternalKeys(array: Array<IKryptos>): void {
    for (const input of array) {
      if (!input.id) {
        throw new AmphoraError("Id is required when adding Kryptos", {
          code: "kryptos_id_required",
          title: "Kryptos ID Required",
          details: "Every Kryptos added to the vault must have an id.",
        });
      }

      const overwrite: Record<string, unknown> = {};

      if (!input.issuer && this.issuer) {
        this.logger.silly("Setting issuer on Kryptos from amphora issuer", {
          id: input.id,
          issuer: this.issuer,
        });
        overwrite.issuer = this.issuer;
      }

      // An issuer that is not an http(s) URL derives no jwksUri — the key simply
      // carries none, exactly as it would under an amphora with no issuer at all.
      const jwksUri = this.issuer ? deriveInternalJwksUri(this.issuer) : null;

      if (!input.jwksUri && jwksUri) {
        this.logger.silly("Setting jwksUri on Kryptos from amphora issuer", {
          id: input.id,
          jwksUri,
        });
        overwrite.jwksUri = jwksUri;
      }

      const item = Object.keys(overwrite).length
        ? KryptosKit.clone(input, overwrite)
        : input;

      if (!item.issuer) {
        throw new AmphoraError("Issuer is required when adding Kryptos", {
          code: "kryptos_issuer_required",
          data: { id: item.id },
          title: "Kryptos Issuer Required",
          details:
            "A Kryptos must have an issuer, either set explicitly or derived from the Amphora issuer.",
        });
      }

      if (item.isExpired) {
        throw new AmphoraError("Kryptos is expired", {
          code: "kryptos_expired",
          data: { id: item.id, issuer: item.issuer, expiresAt: item.expiresAt },
          title: "Kryptos Expired",
          details: `The Kryptos "${item.id}" (issuer "${item.issuer}") expired at ${item.expiresAt?.toISOString()} and cannot be added to the vault.`,
        });
      }

      this.assertEnvironment(item);

      this.replaceKey(item);
    }

    this.refreshJwks();
  }

  // Add FOREIGN keys (via `external.add`): force `internal: false`, no issuer
  // stamp — the provenance invariant for every key that enters an external scope.
  addExternalKeys(array: Array<IKryptos>): void {
    for (const input of array) {
      if (!input.id) {
        throw new AmphoraError("Id is required when adding Kryptos", {
          code: "kryptos_id_required",
          title: "Kryptos ID Required",
          details: "Every Kryptos added to the vault must have an id.",
        });
      }

      // A foreign key brings its OWN issuer or it is not filable. There is no
      // fallback here, unlike the internal side: the amphora issuer is ours, and
      // stamping it on someone else's key would break the very invariant this
      // path exists to hold — every key entering an external scope is
      // `internal: false` and carries no issuer of ours.
      if (!input.issuer) {
        throw new AmphoraError("Issuer is required when adding external Kryptos", {
          code: "kryptos_issuer_required",
          data: { id: input.id },
          title: "Kryptos Issuer Required",
          details:
            "A foreign Kryptos must declare the issuer it belongs to. The Amphora issuer cannot stand in for it — that would claim another party's key as ours — and the vault scopes lookup, eviction and replacement by issuer, so a key with none can neither be found nor evicted.",
        });
      }

      const item =
        input.internal === false ? input : KryptosKit.clone(input, { internal: false });

      this.replaceKey(item);
    }

    this.refreshJwks();
  }

  // The ONE dedupe rule for both add paths: a key replaces the key with the same
  // id UNDER THE SAME ISSUER, and nothing else.
  //
  // ⚠ Scoped to `(id, issuer)`, never the bare id. A kid is unique only PER
  // ISSUER — which is exactly why `findByIdExact` throws `kryptos_ambiguous_id`
  // on a bare id that collides, and why `evictIssuer` / `applyFetchedKeys` scope
  // by issuer. A bare-id dedupe contradicted all three: two peers publishing the
  // same kid, plus one `add` of OUR key carrying that kid, silently deleted BOTH
  // peers' keys.
  //
  // Both callers guarantee `item.issuer` is set before they reach here, so the
  // comparison never collapses two issuer-less keys together.
  private replaceKey(item: IKryptos): void {
    this.assertProvenance(item.id, item.issuer, item.internal);

    this.vault = this.vault
      .filter((i) => i.id !== item.id || i.issuer !== item.issuer)
      .concat(item);
  }

  // THE provenance rule, in ONE place: the vault partitions by `internal`, a
  // slot is `(id, issuer)`, and a write must not cross. Both ID-SCOPED writers
  // ask this before they touch the vault, which covers both directions —
  // `replaceKey` with the incoming key's own provenance (`external.add`
  // normalizes to `internal: false` before it gets here, so facet and flag agree
  // on that side), `removeKey` with the external facet's, being that facet's
  // verb and its only caller. The two ISSUER-SCOPED bulk writers
  // (`evictIssuer` / `applyFetchedKeys`) hold the same rule their own way, by
  // filtering `i.internal` out of what they touch.
  //
  // ⚠ Keyed on `internal`, NEVER on the issuer. A foreign key can legitimately
  // carry OUR issuer — `external.add` accepts one, and must — so "the issuer is
  // ours" says nothing about whose key it is. An issuer comparison would both
  // refuse those legitimate foreign keys and miss the case this exists for.
  //
  // THROW, rather than skip or let the two coexist. Skipping makes a failed
  // removal indistinguishable from a successful one. Coexisting is worse: both
  // keys would occupy the one `(id, issuer)` slot `replaceKey` / `removeKey`
  // treat as unique, so `findByIdExact(id, issuer)` would return two matches and
  // throw `kryptos_ambiguous_id` at LOOKUP time — punishing a read that did
  // nothing wrong. The write that creates the impossible state is what has to
  // fail.
  private assertProvenance(id: string, issuer: string | null, internal: boolean): void {
    const crossing = this.vault.some(
      (i) => i.id === id && i.issuer === issuer && i.internal !== internal,
    );
    if (!crossing) return;

    const held = internal ? "external" : "internal";
    const attempted = internal ? "internal" : "external";

    throw new AmphoraError("Kryptos provenance conflict", {
      code: "kryptos_provenance_conflict",
      data: { id, issuer, held, attempted },
      title: "Kryptos Provenance Conflict",
      details:
        held === "internal"
          ? `The vault already holds the id "${id}" under issuer "${issuer}" as one of OUR keys, and this write comes from the external facet. The vault partitions by provenance and a key id is unique per issuer, so the two would claim the same slot. This key is ours — manage it with amphora.add() / amphora.env(), never amphora.external.add() / amphora.external.remove().`
          : `The vault already holds the id "${id}" under issuer "${issuer}" as a FOREIGN key, and this write comes from the internal side. The vault partitions by provenance and a key id is unique per issuer, so the two would claim the same slot. This key belongs to a foreign issuer — manage it with amphora.external.add() / amphora.external.remove(), never amphora.add() / amphora.env(). A foreign key may carry our own issuer, so the issuer alone does not make it ours.`,
    });
  }

  // Drop ONE key — scoped to `(id, issuer)` exactly as `replaceKey` is, and for
  // the same reason: a kid is unique only PER ISSUER, so a bare id names every
  // issuer's key that carries it. Filtering on the bare id deleted the kid from
  // EVERY issuer at once — the mirror of the dedupe bug above, against the same
  // invariant `findByIdExact` refuses to guess at (`kryptos_ambiguous_id`) and
  // `evictIssuer` / `applyFetchedKeys` scope by.
  //
  // This IS the external facet's key verb — `external.remove` is its only
  // caller — so the write's provenance is external, and naming one of OUR keys
  // through it crosses. See `assertProvenance`.
  removeKey(id: string, issuer: string): void {
    this.assertProvenance(id, issuer, false);

    this.vault = this.vault.filter((i) => i.id !== id || i.issuer !== issuer);
    this.refreshJwks();
  }

  // Install an EXTERNAL issuer source and enforce the cap. `lastAccess` is
  // stamped now — registration counts as use, so a just-registered issuer is
  // never the immediate eviction victim (only ever-idle peers are). The idp does
  // NOT flow through here (it is a singleton on `idpEntry`, exempt from the cap).
  //
  // IDEMPOTENT BY ISSUER: an issuer already held is REPLACED in place, never
  // appended beside itself. Appending cost three separate things — a second
  // entry spent a second `maxIssuers` slot, a second fetch ran for one issuer,
  // and `removeIssuer` left a GHOST (it dropped one entry while eviction drops
  // ALL of that issuer's keys, so the listing named an issuer holding nothing).
  // The registering caller is a request handler with an `await` between "do we
  // have it?" and "add it", so it cannot dedupe this itself.
  addExternalEntry(entry: ExternalEntry): void {
    entry.lastAccess = new Date();

    const issuer = entry.issuer ?? entry.input.issuer ?? null;
    const index =
      issuer === null
        ? -1
        : this.externalEntries.findIndex(
            (item) => item.issuer === issuer || item.input.issuer === issuer,
          );

    if (index === -1) {
      this.externalEntries.push(entry);
    } else {
      const [replaced] = this.externalEntries.splice(index, 1, entry);
      const replacedIssuer = replaced.issuer ?? replaced.input.issuer ?? null;

      // The replaced entry's keys are filed under the issuer it RESOLVED, which
      // is not necessarily the one it was MATCHED by: a discovery document's
      // published issuer wins over the declared one, so an entry found through
      // `input.issuer` can hold keys under a different name. Dropping such an
      // entry without its keys strands them — no entry names that issuer any
      // more, so `removeIssuer` can never reach them and the vault keeps serving
      // a source amphora no longer lists. When the two names agree there is
      // nothing to do: the install that follows replaces those keys anyway.
      //
      // ⚠ Issuer-scoped eviction, so it MUST precede the keys — which it does:
      // a registration installs the entry here and applies its keys after.
      if (replacedIssuer !== null && replacedIssuer !== issuer) {
        this.evictIssuer(replacedIssuer);
      }
    }

    this.enforceIssuerCap();
  }

  // Drop every entry holding this issuer and hand them back, so the caller can
  // evict each one's keys under the issuer they were actually FILED under (a
  // discovery document's published issuer wins over the declared one, so an
  // entry matched by `input.issuer` can hold keys under a different name).
  //
  // ALL of them, not the first: eviction is by issuer and takes every one of its
  // keys, so removing a single entry is what left a ghost behind. Registration
  // now dedupes, so the plural covers an operator who declared the same issuer
  // twice in the constructor.
  removeExternalEntries(issuer: string): Array<ExternalEntry> {
    const removed = this.externalEntries.filter(
      (entry) => entry.issuer === issuer || entry.input.issuer === issuer,
    );

    if (removed.length === 0) return removed;

    this.externalEntries = this.externalEntries.filter(
      (entry) => !removed.includes(entry),
    );

    return removed;
  }

  // Hard, deterministic bound on the number of EXTERNAL issuers — evict the
  // least-recently-USED (smallest `lastAccess`; `null` = never used, sorts oldest)
  // until at or under `maxIssuers`. Inline on registration overflow, no background
  // sweeper. The idp is not in `externalEntries`, so it is never a candidate.
  //
  // ⚠ Eviction does NOT self-heal, and nothing here makes it. An evicted issuer
  // is GONE — `refreshIssuer` finds no entry and no-ops, so a later lookup for
  // its keys simply fails. Re-registration is the CONSUMER's job: a consumer that
  // relies on the cap must call `external.addIssuer` before the lookup that needs
  // the issuer (which is what a per-request registration flow does anyway), not
  // assume amphora will bring it back.
  private enforceIssuerCap(): void {
    while (this.externalEntries.length > this.maxIssuers) {
      let victimIndex = 0;
      let victimTime = Infinity;

      this.externalEntries.forEach((entry, index) => {
        const time = entry.lastAccess ? entry.lastAccess.getTime() : 0;
        if (time < victimTime) {
          victimTime = time;
          victimIndex = index;
        }
      });

      const [victim] = this.externalEntries.splice(victimIndex, 1);
      const issuer = victim.issuer ?? victim.input.issuer ?? null;

      this.logger.warn(
        "Evicting least-recently-used external issuer (maxIssuers cap reached)",
        { issuer, maxIssuers: this.maxIssuers, lastAccess: victim.lastAccess },
      );

      this.evictIssuer(issuer);
    }
  }

  // Drop a foreign issuer's fetched keys — never our own (an env-imported key can
  // legitimately carry the same issuer and must survive).
  evictIssuer(issuer: string | null): void {
    if (!issuer) return;
    this.vault = this.vault.filter((i) => i.internal || i.issuer !== issuer);
    this.refreshJwks();
  }

  // Is this entry one amphora is CURRENTLY serving from? By IDENTITY, not by
  // issuer: a replacement carries the same issuer as the entry it replaced, and
  // "same issuer" is exactly what must not count as "still installed".
  private holdsEntry(entry: ExternalEntry): boolean {
    return this.idpEntry === entry || this.externalEntries.includes(entry);
  }

  // INSTALL one entry's fetched keys — the second half of every load, and the
  // only step that makes a registration visible in the vault. Public because a
  // SWAP (`idp.set` / `external.addIssuer`) stages the fetch first and calls
  // this once the keys are in hand.
  //
  // ⚠ It replaces this issuer's foreign keys, so an issuer-scoped eviction that
  // belongs to the same swap MUST run BEFORE it — evicting afterwards would drop
  // the keys just installed when the new source names the same issuer.
  //
  // ⚠ An entry amphora no longer HOLDS installs nothing. A load is not atomic
  // with the state it was started against: a refresh of one source can still be
  // in flight when a re-registration (or `idp.set`) replaces it, and applying
  // afterwards would strip the keys the replacement just installed and put the
  // superseded source's back — leaving the listing naming one source while the
  // vault serves another's keys. The entry is dropped rather than the keys
  // merged, because a detached entry's `keyCount` / `lastRefresh` are equally
  // meaningless.
  applyFetchedKeys(entry: ExternalEntry, keys: Array<IKryptos>): void {
    if (!this.holdsEntry(entry)) {
      this.logger.debug("Discarding fetched keys for a superseded external entry", {
        issuer: entry.issuer ?? entry.input.issuer ?? null,
        origin: entry.origin,
        keyCount: keys.length,
      });
      return;
    }

    this.vault = this.vault
      .filter((i) => i.internal || i.issuer !== entry.issuer)
      .concat(keys);
    entry.keyCount = keys.length;
    entry.lastRefresh = new Date();

    // Success is the ONLY writer that clears the retry pair, and it clears both:
    // the count feeds the next backoff, and a stale `retryAfter` would keep
    // gating the speculative refetch of an issuer that is demonstrably healthy.
    // The recovery log reads the count first, so it still knows what it recovered
    // from.
    if (entry.failureCount > 0) this.logRecovery(entry);

    entry.failureCount = 0;
    entry.retryAfter = null;

    this.refreshJwks();
  }

  refreshJwks(): void {
    if (this.issuer === null) return;

    this.logger.silly("Refreshing JWKS");

    this._jwks = Matcher.filter(this.vault, {
      hasPublicKey: true,
      publish: true,
      isExpired: false,
      // We publish OUR keys and only ours — republishing a key fetched from
      // someone else's JWKS would advertise their key material as our own.
      internal: true,
      issuer: this.issuer,
    })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((i) => i.toJWK("public"));
  }

  // external fetch orchestration

  // Re-resolve one entry's config from its verbatim `input`, then fetch + apply
  // its keys. The REFRESH path: the entry is already installed, so resolving in
  // place and applying straight away is the whole operation.
  //
  // PRIVATE, so `refreshEntry` is the only way to reach it. A second, equally
  // reachable load that skipped the failure recording is precisely what left
  // `idp.refresh()` with neither a backoff stamp nor a first-failure `warn`
  // while the identical failure one call away had both.
  private async loadEntry(entry: ExternalEntry): Promise<void> {
    this.applyFetchedKeys(entry, await this.prepareEntry(entry));
  }

  // Resolve + fetch WITHOUT touching the vault — everything a load does that can
  // fail, and nothing it does that a caller would have to undo. The entry itself
  // is enriched (issuer / jwksUri / discovery doc), which is safe precisely
  // because a REGISTRATION passes an entry nothing is serving from yet: the
  // caller installs it, with its keys, only once this resolves.
  //
  // This is what makes a swap all-or-nothing. Registration used to mutate the
  // shared state first and load after, so a failure left the service with
  // neither the source it replaced nor a working new one.
  async prepareEntry(entry: ExternalEntry): Promise<Array<IKryptos>> {
    await this.resolveEntry(entry);
    return this.fetchKeys(entry);
  }

  private async resolveEntry(entry: ExternalEntry): Promise<void> {
    const resolved = await resolveExternalConfig(this.conduit, entry.input);

    // A discovery-derived issuer was unknown at registration; enforce scope
    // exclusivity now that it is settled (excluding this same entry).
    this.assertIssuerScopeFree(resolved.issuer, entry.scope, entry);

    // The three fields resolution settles — which is everything it returns.
    // `required` and `scope` are not among them BY CONSTRUCTION: resolution
    // re-derives from `input`, which declares neither for the idp (its settings
    // type has no `required`, and nothing in an input says which scope it was
    // registered in), so a resolved value for either could only be wrong. Both
    // are written once, at seed, and never again.
    entry.issuer = resolved.issuer;
    entry.jwksUri = resolved.jwksUri;
    entry.openIdConfiguration = resolved.openIdConfiguration;
  }

  private fetchKeys(entry: ExternalEntry): Promise<Array<IKryptos>> {
    return fetchExternalJwks(this.conduit, entry, {
      maxExternalKeys: this.maxExternalKeys,
      logger: this.logger,
    });
  }

  private async fetchEntry(entry: ExternalEntry): Promise<void> {
    this.applyFetchedKeys(entry, await this.fetchKeys(entry));
  }

  // Refetch every DECLARED issuer — the idp and the constructor `external` set.
  // Both phases are `Promise.allSettled`, so one unreachable provider never
  // denies the others, and the whole sweep costs ONE round-trip of wall clock
  // rather than N.
  //
  // ⚠ REGISTERED issuers are NOT in this sweep. Their population is sized by
  // client registrations, so a timer that refetched them would poll the entire
  // client population on one cadence — outbound traffic shaped like a DDoS from
  // the recipients' side, and a synchronous JWK-parse spike on the event loop to
  // match. They are refreshed by the DEMAND path instead: a scoped lookup's
  // staleness (gated by `retryAfter`) and a kid/query miss (never gated), which
  // between them cover exactly the issuers actually in use, at the same
  // `refreshInterval` bound. An issuer nobody authenticates as has no key anyone
  // reads, so there is nothing to revoke against.
  //
  // ⚠ The accepted cost: an UNSCOPED path no longer reaches a registered issuer,
  // for staleness or for miss recovery (`findById(id)` with no issuer routes
  // here). Read a registered issuer's keys through a SCOPED lookup —
  // `find({ id, issuer })` — which keeps both.
  //
  // `strict` is the ONLY difference between the SETUP sweep and the periodic
  // one, expressed as a parameter rather than a second code path that could
  // drift. The asymmetry is deliberate and each half has its own reason:
  //
  // - STRICT at boot (`setup()`): a service whose `required` upstream cannot be
  //   resolved cannot do its job — it could not verify a single token from that
  //   issuer — so it must not come up pretending otherwise. It throws the real
  //   cause.
  // - LENIENT afterwards (every periodic refresh): the process is already
  //   serving, on keys that resolved. A transient blip at the provider must not
  //   kill it. Each failure is recorded and backed off to `retryAfter`.
  //
  // Per-entry `required` REPLACES the old "every provider failed" throw: two
  // throw conditions for one situation is what this collapses.
  async refreshAll(strict = false): Promise<void> {
    this.logger.silly("Refreshing vault");

    const started = Date.now();
    const entries = this.declaredEntries;
    if (entries.length === 0) return;

    const failures = new Map<ExternalEntry, unknown>();

    const resolveResults = await Promise.allSettled(
      entries.map((entry) => this.resolveEntry(entry)),
    );

    resolveResults.forEach((result, index) => {
      if (result.status === "rejected") {
        failures.set(entries[index], result.reason);
        this.recordLoadFailure(
          entries[index],
          "Failed to load external config",
          result.reason,
        );
      }
    });

    const resolved = entries.filter((entry) => !failures.has(entry));

    const fetchResults = await Promise.allSettled(
      resolved.map((entry) => this.fetchEntry(entry)),
    );

    fetchResults.forEach((result, index) => {
      if (result.status === "rejected") {
        failures.set(resolved[index], result.reason);
        this.recordLoadFailure(
          resolved[index],
          "Failed to refresh external JWKS",
          result.reason,
        );
      }
    });

    // ONE line per sweep, whatever N is — the per-issuer detail is already on
    // each entry's own log line, and at client scale a per-entry summary is the
    // noise that hides it. Emitted BEFORE the strict verdict so a boot that is
    // about to die still says how far the sweep got. `skipped` is the registered
    // population this sweep deliberately did not touch.
    this.logger.verbose("External refresh sweep complete", {
      attempted: entries.length,
      succeeded: entries.length - failures.size,
      failed: failures.size,
      skipped: this.allEntries.length - entries.length,
      durationMs: Date.now() - started,
    });

    if (!strict) return;

    for (const entry of entries) {
      if (entry.required !== true || !failures.has(entry)) continue;

      // The per-entry failure line above already carries the cause; this states
      // the reason the process is about to die, which the cause alone does not
      // say — and it is `error` regardless of provenance, because a `required`
      // issuer failing is by definition not routine churn. The cause
      // itself is what gets thrown — a wrapper would bury the one thing an
      // operator needs (a 503, a bad JWKS, an unreachable host) one level down.
      this.logger.error("Required issuer could not be loaded", {
        issuer:
          entry.issuer ??
          entry.input.issuer ??
          entry.input.openIdConfigurationUri ??
          null,
      });

      throw failures.get(entry);
    }
  }

  refresh(): Promise<void> {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async (): Promise<void> => {
      try {
        await this.refreshAll();
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  // Refetch ONE entry and RECORD a failure before it propagates — the single
  // targeted-refresh path, taken by the per-issuer refresh below and by
  // `idp.refresh()`. Failure recording lives here rather than in each caller
  // because a caller that skipped it left an issuer with no backoff stamp and no
  // first-failure `warn`, while the identical failure one call away had both.
  //
  // The error still reaches the caller that asked: recording a failure is
  // bookkeeping, not handling it.
  async refreshEntry(entry: ExternalEntry): Promise<void> {
    try {
      await this.loadEntry(entry);
    } catch (error) {
      this.recordLoadFailure(entry, "Failed to refresh external issuer", error);
      throw error;
    }
  }

  // Targeted refetch of ONE issuer (deduplicated per issuer). A no-op when no
  // external entry owns the issuer — the granular find-miss path can pass a
  // local-only issuer, which simply has nothing to refetch.
  //
  // This is the ONLY refresh a REGISTERED issuer gets: the demand path is where
  // such an issuer's backoff is written, and the scheduled sweep never sees it.
  refreshIssuer(issuer: string): Promise<void> {
    const entry = this.findEntry(issuer);
    if (!entry) return Promise.resolve();

    const existing = this.issuerRefreshPromises.get(issuer);
    if (existing) return existing;

    const promise = (async (): Promise<void> => {
      try {
        await this.refreshEntry(entry);
      } finally {
        this.issuerRefreshPromises.delete(issuer);
      }
    })();

    this.issuerRefreshPromises.set(issuer, promise);
    return promise;
  }

  // REGISTER an external issuer source from a request: resolve + fetch, then
  // install. Deduplicated per issuer exactly as `refreshIssuer` is, because the
  // caller cannot do it — a registration flow is check-then-act with an `await`
  // in the middle, so two concurrent first-time authentications for one client
  // both see "not registered" and both register.
  //
  // The dedupe key is the DECLARED issuer. A source named by
  // `openIdConfigurationUri` alone has no issuer to key on until the document is
  // fetched, so it cannot be deduped in flight — `addExternalEntry` still
  // collapses it once the issuer settles. ⚠ A caller joining an in-flight
  // registration gets THAT registration's source, not its own; the case this
  // exists for is one client registering itself twice at once, where the two
  // sources are the same. A genuinely different source for the same issuer is a
  // REPLACEMENT — issue it after the first settles.
  //
  // Registration comes AFTER the fetch, and the resolve+fetch happens against a
  // STAGED entry: it spends the `maxIssuers` cap and that spend can evict a peer,
  // so a source that never loaded must not buy a working peer's eviction.
  //
  // `async` so that the synchronous guards below surface as a REJECTION rather
  // than a throw — a promise-returning registration must fail one way, not two.
  async registerIssuer(source: AmphoraExternalSettings): Promise<void> {
    // One issuer, one scope — an external issuer cannot also be the idp.
    this.assertIssuerScopeFree(source.issuer, "external");

    const issuer = source.issuer ?? null;
    if (issuer === null) return this.loadRegistration(source);

    const existing = this.issuerRegisterPromises.get(issuer);
    if (existing) return existing;

    const promise = (async (): Promise<void> => {
      try {
        await this.loadRegistration(source);
      } finally {
        this.issuerRegisterPromises.delete(issuer);
      }
    })();

    this.issuerRegisterPromises.set(issuer, promise);
    return promise;
  }

  private async loadRegistration(source: AmphoraExternalSettings): Promise<void> {
    const entry = seedExternalConfig(source, "registered");

    try {
      // Resolve + fetch into the staged entry — nothing amphora holds is touched
      // until this returns.
      const keys = await this.prepareEntry(entry);

      // Install, cap-enforce (eviction runs inside, hence BEFORE the keys land:
      // an overflow victim sharing this issuer would otherwise take the new keys
      // with it), then make the keys visible.
      this.addExternalEntry(entry);
      this.applyFetchedKeys(entry, keys);
    } catch (error) {
      // ⚠ No `scheduleRetry` here, deliberately. The staged entry is discarded
      // on this path — it was never installed, nothing can reach it, and no
      // reader will ever consult its `retryAfter`. Stamping an already-installed
      // entry for the same issuer instead would be worse than useless: this
      // registration carries its OWN source config, so its failure says nothing
      // about the source that is currently serving. The failure is reported to
      // the caller, which is the party that decides whether to try again.
      this.logger.debug("Failed to register external issuer", {
        error,
        issuer: entry.issuer ?? entry.input.issuer ?? null,
        origin: entry.origin,
      });

      throw error;
    }
  }

  refreshFor(condition: AmphoraCondition): Promise<void> {
    const issuer = condition.issuer;
    return isString(issuer) ? this.refreshIssuer(issuer) : this.refresh();
  }
}
