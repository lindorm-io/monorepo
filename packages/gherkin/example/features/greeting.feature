@greeting
Feature: Greeting

  Background:
    Given the greeting "Hello"

  Example: greet a name
    When I greet "World"
    Then the result is "Hello, World!"
    And the book has recorded 3 steps

  Example: greet shouting
    When I greet "world" shouting
    Then the result is "Hello, WORLD!"

  Example: greet a table of guests
    When I greet everyone
      | name |
      | Anna |
      | Bo   |
    Then the result is "Hello, Anna! Hello, Bo!"

  Scenario Outline: every greeting applies
    Given the greeting "<greeting>"
    When I greet "Lindorm"
    Then the result is "<greeting>, Lindorm!"

    Examples:
      | greeting |
      | Hi       |
      | Hej      |
