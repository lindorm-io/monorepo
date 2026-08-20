Feature: Data arguments

  Scenario: a data table converts to a typed set
    Given the catalog
      | name  | price |
      | apple | 3     |
      | pear  | 4     |
    Then the total price is "7"

  Scenario: a one-row table creates one product
    Given the product
      | name | price |
      | fig  | 5     |
    Then the product costs "5"

  Scenario: a doc string arrives with its media type
    Given the payload
      """json
      {"note":"hello"}
      """
    Then the payload notes "hello" as "json"

  Scenario Outline: cells substitute from Examples
    Given the catalog
      | name   | price   |
      | <name> | <price> |
    Then the total price is "<price>"

    Examples:
      | name | price |
      | kiwi | 9     |
