import { IQueryHandler } from "../../src";
import { GetViewFromPostgres } from "./get-view-from-postgres.query";

const main: IQueryHandler<GetViewFromPostgres, unknown> = {
  query: GetViewFromPostgres,
  view: "postgres_greetings",
  handler: ({ query, repositories }) => repositories.postgres.findById(query.id),
};
export default main;
