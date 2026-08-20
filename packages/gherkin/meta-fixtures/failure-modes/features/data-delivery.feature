Feature: data delivery

  Scenario: the trailing slot is stable
    Given a slotless sentinel step

  Scenario: a doc string arrives verbatim with its media type
    Given a documented payload
      """markdown
      # Title ${not_code}
      body line
      """

  Scenario: a table converts to a typed set
    Given a typed catalog
      | name  | price |
      | apple | 3     |
      | pear  | 4     |

  Scenario: a one-row table creates one object
    Given a typed product
      | name | price |
      | fig  | 5     |

  Scenario Outline: substituted cells reach the table
    Given a sentinel table
      | value   |
      | <value> |

    Examples:
      | value       |
      | substituted |
