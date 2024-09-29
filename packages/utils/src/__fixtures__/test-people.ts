type Person = {
  id: string;
  name: string;
  common: string;
  address: {
    street: string;
    city: string;
  };
  friends: Array<{
    id: string;
    name: string;
  }>;
};

export const TEST_PEOPLE: Array<Person> = [
  {
    id: "1",
    name: "John Doe",
    common: "common",
    address: {
      street: "123 Main St",
      city: "New York",
    },
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
    friends: [
      { id: "1", name: "John Doe" },
      { id: "2", name: "Jane Black" },
      { id: "3", name: "Quintin Smith" },
    ],
  },
];
