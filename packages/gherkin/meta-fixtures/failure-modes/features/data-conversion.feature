Feature: data conversion failures

  Scenario: a sync parse of an async schema names its own fix
    Given an async schema parsed synchronously
      | name |
      | x    |

  Scenario: a violating table set is red
    Given a violating catalog
      | name  | price |
      | apple | oops  |

  Scenario: create on a multi-row table is loud
    Given a created product
      | name | price |
      | fig  | 5     |
      | lime | 6     |
