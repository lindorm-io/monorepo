Feature: data conversion failures

  Scenario: a sync parse of an async schema names its own fix
    Given an async schema parsed synchronously
      | name |
      | x    |
    Then the scenario stops before this step
  Scenario: a violating table set is red
    Given a violating catalog
      | name  | price |
      | apple | oops  |
    Then the scenario stops before this step
  Scenario: create on a multi-row table is loud
    Given a created product
      | name | price |
      | fig  | 5     |
      | lime | 6     |
    Then the scenario stops before this step
