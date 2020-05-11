/*
 * playing_cards.js
 *
 * A set of standard playing cards using the cards.js card game library.
 */

import * as cards from './modules/cards.js'

//---------//
// Globals //
//---------//

export var SUITS = [ "hearts", "clubs", "diamonds", "spades" ];

export var SUIT_SYMBOLS = {
    "diamonds":"♦",
    "hearts": "♥",
    "spades": "♠",
    "clubs": "♣",
    "jokers": "JJ"
}

export var SUIT_COLORS = {
    "diamonds":"red",
    "hearts": "red",
    "spades": "black",
    "clubs": "black",
    "jokers": "purple"
}

export var CARD_NAMES = {
    0: "Joker",
    1: "Ace",
    11: "Jack",
    12: "Queen",
    13: "King",
}

export var LIBRARY = new cards.Library("playing cards");

//-----------------//
// Card Appearance //
//-----------------//

/**
 * Returns true if the named card is not a numbered card (i.e., if it's a
 * Jack, Queen, King, Ace, or Joker).
 *
 * @param card_name The name of the card.
 */
function is_unnumbered(card_name) {
    return card_name.length > 2;
}

/**
 * Builds the HTML code for the face of the card with the given
 * parameters.
 *
 * @param suit A string indicating the suit of the card.
 * @param symbol A string indicating the symbol for this card's suit.
 * @param rank The numerical rank of this card.
 * @param name The full name of this card.
 * @param short_name A shortened version of the card name; should be 1 or
 *     2 characters.
 */
function build_card_face(suit, symbol, rank, name, short_name) {
    let face_symbols = ""
    let count_class = "count_" + rank;
    if (is_unnumbered(name)) {
        count_class = "special";
        face_symbols = "<div class='face_symbol'>" + short_name + "</div>";
    } else {
        face_symbols = "";
        for (let i = 0; i < rank; i += 1) {
            face_symbols += "<div class='face_symbol'>" + symbol + "</div>";
        }
    }
    let corner = (
        "<span class='corner'>"
      + "<span class='rank'>" + short_name + "</span>"
      + "<span class='suit_symbol'>" + symbol + "</span>"
      + "</span>"
    );
    return (
        "<div class='card_face " + suit + " " + SUIT_COLORS[suit] + "'>"
      + corner
      + "<div class='face_symbols " + count_class + "'>"
      + face_symbols
      + "</div>"
      + corner
      + "</div>"
    );
}

//-------------------//
// Card Registration //
//-------------------//

// Create all 52 main cards:
for (let suit of SUITS) {
    let symbol = SUIT_SYMBOLS[suit];
    for (let rank of [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13 ]) {
        let card_name = "" + rank;
        if (CARD_NAMES.hasOwnProperty(rank)) {
            card_name = CARD_NAMES[rank];
        }
        let short_name = card_name;
        if (is_unnumbered(card_name)) {
            short_name = card_name[0];
        }
        LIBRARY.register_card(
            card_name + " of " + suit,
            build_card_face(suit, symbol, rank, card_name, short_name),
            {
                "suit": suit,
                "symbol": symbol,
                "rank": rank,
                "name": card_name,
                "short_name": short_name
            }
        );
    }
}

// Add two jokers:
LIBRARY.register_card(
    "Joker #1",
    build_card_face("jokers", "", 0, "Joker", "J O K E R"),
    {
        "suit": "jokers",
        "symbol": "",
        "rank": 0,
        "name": "Joker",
        "short_name": "J O K E R",
    }
);

LIBRARY.register_card(
    "Joker #2",
    build_card_face("jokers", "", 0, "Joker", "J O K E R"),
    {
        "suit": "jokers",
        "symbol": "",
        "rank": 0,
        "name": "Joker",
        "short_name": "J O K E R",
    }
);

//-------------//
// Card Groups //
//-------------//

// Create groups for each suit and color
for (let suit of SUITS) {
    LIBRARY.create_group(suit, props => props.suit == suit);
}
// "jokers" is not a real suit
LIBRARY.create_group("jokers", props => props.suit == "jokers");

LIBRARY.create_group("red", props => SUIT_COLORS[props.suit] == "red");
LIBRARY.create_group("black", props => SUIT_COLORS[props.suit] == "black");

//-----------------------//
// Convenience Functions //
//-----------------------//

/**
 * Returns the rank of the given card (1-13, and 0 for Jokers).
 *
 * @param card The card to inspect.
 */
function card_rank(card) {
    return card.properties.rank;
}

/**
 * Returns the suit of the given card ("diamonds", "clubs", "hearts",
 * "spades", or "jokers").
 *
 * @param card The card to inspect.
 */
function card_suit(card) {
    return card.properties.suit;
}

/**
 * Returns the color of the given card ("red" for diamonds and hearts
 * cards, "black" for clubs and spades cards, and "purple" for jokers).
 *
 * @param card The card to inspect.
 */
function card_color(card) {
    return SUIT_COLORS[card.properties.suit];
}
