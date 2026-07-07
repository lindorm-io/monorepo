export type StaticCacheControlOptions = {
  visibility: "public" | "private";
  maxAge: number;
  immutable: boolean;
};

// `<public|private>, max-age=<seconds>[, immutable]`.
export const buildStaticCacheControl = (options: StaticCacheControlOptions): string => {
  const parts = [options.visibility, `max-age=${options.maxAge}`];

  if (options.immutable) {
    parts.push("immutable");
  }

  return parts.join(", ");
};
