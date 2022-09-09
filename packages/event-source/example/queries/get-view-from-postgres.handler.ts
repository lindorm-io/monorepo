import { GetViewFromPostgres } from "./get-view-from-postgres.query";
import { QueryHandler } from "../../src";

const main: QueryHandler<GetViewFromPostgres, unknown> = {
  query: GetViewFromPostgres,
  view: "postgres_greetings",
  handler: (ctx) => ctx.repositories.postgres.findById(ctx.query.id),
};
export default main;
