Feature: data delivery

  Scenario: the trailing slot is stable
    Given a slotless sentinel step
    Then the step saw one undefined slot

  Scenario: a doc string arrives verbatim with its media type
    Given a documented payload
      """markdown
      # Title ${not_code}
      body line
      """
    Then the payload arrived as "markdown"

  Scenario: a table converts to a typed set
    Given a typed catalog
      | name  | price |
      | apple | 3     |
      | pear  | 4     |
    Then the total price is "7"

  Scenario: a one-row table creates one object
    Given a typed product
      | name | price |
      | fig  | 5     |
    Then the product costs "5"

  Scenario Outline: substituted cells reach the table
    Given a sentinel table
      | value   |
      | <value> |
    Then the cell reads "<value>"

    Examples:
      | value       |
      | substituted |
