# `cards`

A Javascript library for creating card games.

Allows the creation of custom card games using a library of cards, and
supports the following concepts:

- Cards: Arbitrary HTML on the front, can be flipped upside-down to reveal
  a generic back.
- Piles: Stacks of cards in a specific order. Can be displayed in various
  ways.
- Stacks: Cards that are attached to another card in some order. Stacked
  cards are always in the same pile.
- Phases: Periods of time during play that end when a limit is reached
  (or when the player decides to end them).
- Libraries: Registries of all possible cards for a certain game.
- Games: Active game sessions that keep track of card, pile, and phase states.

Comes with a demo that defines a library for standard playing cards, and
then defines rules for solitaire.

## TODO

Currently being worked on:

- Core engine
    * card/pile action UI
    * card playing UI and general drag-and-drop

## Multiplayer

The library currently *does not* support multi-player games! This is
obviously a crippling flaw. We'll get there some day.
