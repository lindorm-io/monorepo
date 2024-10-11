export type TestPerson = {
  id: string;
  name: string;
  common: string;
  address: {
    street: string;
    city: string;
  };
  age: number;
  joinedAt: Date;
  hobbies: string[];
  friends: Array<{
    id: string;
    name: string;
  }>;
};

export const TEST_PEOPLE: Array<TestPerson> = [
  {
    id: "1",
    name: "John Doe",
    common: "common",
    address: {
      street: "123 Main St",
      city: "New York",
    },
    age: 30,
    joinedAt: new Date("2020-01-01"),
    hobbies: ["reading", "coding", "gaming"],
    friends: [
      { id: "2", name: "Jane Black" },
      { id: "3", name: "Quintin Smith" },
    ],
  },
  {
    id: "2",
    name: "Jane Black",
    common: "common",
    address: {
      street: "456 Elm St",
      city: "Los Angeles",
    },
    age: 25,
    joinedAt: new Date("2019-01-01"),
    hobbies: ["music", "dancing"],
    friends: [
      { id: "1", name: "John Doe" },
      { id: "4", name: "Alice Fisher" },
    ],
  },
  {
    id: "3",
    name: "Quintin Smith",
    common: "common",
    address: {
      street: "789 Oak St",
      city: "New York",
    },
    age: 35,
    joinedAt: new Date("2018-06-15"),
    hobbies: ["photography", "traveling"],
    friends: [
      { id: "1", name: "John Doe" },
      { id: "4", name: "Alice Fisher" },
    ],
  },
  {
    id: "4",
    name: "Alice Fisher",
    common: "common",
    address: {
      street: "999 Secondary St",
      city: "London",
    },
    age: 28,
    joinedAt: new Date("2021-03-10"),
    hobbies: ["cooking", "traveling"],
    friends: [
      { id: "1", name: "John Doe" },
      { id: "2", name: "Jane Black" },
      { id: "3", name: "Quintin Smith" },
    ],
  },
];
