import { IQueryHandler } from "../../src";
import { GetViewFromMongo } from "./get-view-from-mongo.query";

const main: IQueryHandler<GetViewFromMongo, unknown> = {
  query: GetViewFromMongo,
  view: "mongo_greetings",
  handler: ({ query, repositories }) => repositories.mongo.findById(query.id),
};
export default main;
