type Ops = {
  $exists?: boolean;

  $eq?: Date | string | number; // equal
  $ne?: Date | string | number; // not equal

  $in?: Array<string | number>; // in
  $nin?: Array<string | number>; // not in

  // arrays

  $has?: string; // has
  $not?: string; // not has

  $all?: Array<string>; // has all
  $any?: Array<string>; // has any
  $none?: Array<string>; // has none

  // dates

  $before?: Date; // before
  $beforeOrEq?: Date; // before or equal

  $after?: Date; // after
  $afterOrEq?: Date; // after or equal

  // numbers

  $gt?: number; // greater than
  $gte?: number; // greater than or equal

  $lt?: number; // less than
  $lte?: number; // less than or equal

  // strings

  $regex?: string; // regex
};

export type Operators = Ops & {
  $and?: Array<Operators>;
  $or?: Array<Operators>;
};
