import type { IAmphora } from "@lindorm/amphora";
import { add, duration, type ReadableTime } from "@lindorm/date";
import { describeCertificate, type DescribedX509Certificate } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { type CreateLindormWorkerSettings, LindormWorker } from "@lindorm/worker";

type Options = CreateLindormWorkerSettings & {
  amphora: IAmphora;
  logger: ILogger;
  // Time-to-expiry thresholds. A cert at or past `errorThreshold` (or already
  // expired) logs `error`; at or past `warnThreshold` logs `warn`.
  warnThreshold?: ReadableTime;
  errorThreshold?: ReadableTime;
};

type Severity = "error" | "warn" | "healthy";

// A cert tracked once per run, with the kids of every vault key that carries it.
type Tracked = {
  described: DescribedX509Certificate;
  kids: Set<string>;
};

const MS_PER_DAY = 86_400_000;

const severityFor = (notAfter: Date, errorBy: Date, warnBy: Date): Severity => {
  // errorThreshold < warnThreshold, so errorBy < warnBy — check the tighter
  // bound first. `notAfter <= errorBy` also covers an already-expired cert.
  if (notAfter.getTime() <= errorBy.getTime()) return "error";
  if (notAfter.getTime() <= warnBy.getTime()) return "warn";
  return "healthy";
};

const logData = (tracked: Tracked, now: Date) => ({
  subject:
    tracked.described.subject.commonName ??
    tracked.described.subject.organization ??
    "(no CN)",
  ...(tracked.described.subject.organizationalUnit
    ? { environment: tracked.described.subject.organizationalUnit }
    : {}),
  notAfter: tracked.described.notAfter,
  daysRemaining: Math.floor(
    (new Date(tracked.described.notAfter).getTime() - now.getTime()) / MS_PER_DAY,
  ),
  kids: [...tracked.kids],
});

export const createCertificateExpiryWorker = (options: Options): LindormWorker => {
  const warnThreshold: ReadableTime = options.warnThreshold ?? "3mo";
  const errorThreshold: ReadableTime = options.errorThreshold ?? "1mo";

  // LindormWorker requires exactly one of interval or cron: default to a daily
  // cron, but honour an explicit `interval` override if a caller prefers one.
  const schedule =
    options.interval !== undefined
      ? { interval: options.interval }
      : { cron: options.cron ?? "0 10 * * *" };

  return new LindormWorker({
    alias: "CertificateExpiryWorker",
    ...schedule,
    timezone: options.timezone ?? "UTC",
    listeners: options.listeners ?? [],
    jitter: options.jitter,
    retry: options.retry,
    logger: options.logger,
    callback: async (ctx): Promise<void> => {
      const now = new Date();
      const errorBy = add(now, duration(errorThreshold));
      const warnBy = add(now, duration(warnThreshold));

      // Dedupe by x5t#S256 across the whole run: the same issuing/root CA cert
      // appears in every rotation key's chain, so it must produce ONE log line,
      // annotated with all the kids that reference it.
      const tracked = new Map<string, Tracked>();

      for (const kryptos of options.amphora.vault) {
        if (!kryptos.hasCertificate) continue;

        for (const der of kryptos.certificateChain) {
          const described = describeCertificate(der);
          const existing = tracked.get(described.thumbprint);

          if (existing) {
            existing.kids.add(kryptos.id);
          } else {
            tracked.set(described.thumbprint, {
              described,
              kids: new Set([kryptos.id]),
            });
          }
        }
      }

      let warn = 0;
      let error = 0;

      for (const entry of tracked.values()) {
        const notAfter = new Date(entry.described.notAfter);

        switch (severityFor(notAfter, errorBy, warnBy)) {
          case "error":
            ctx.logger.error("Certificate at or past expiry", logData(entry, now));
            error++;
            break;

          case "warn":
            ctx.logger.warn("Certificate approaching expiry", logData(entry, now));
            warn++;
            break;

          case "healthy":
            break;

          default:
            throw new Error("Unreachable certificate severity");
        }
      }

      ctx.logger.verbose("Certificate expiry check complete", {
        checked: tracked.size,
        warn,
        error,
      });
    },
  });
};
