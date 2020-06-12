/*
 * solitaire.js
 *
 * A set of rules for solitaire to test the cards.js card game library.
 */

import * as cards from './modules/cards.js'
import * as playing_cards from './playing_cards.js'

/**
 * Setup function for the start of the game. Creates a copy of each card
 * in the library (except the Jokers) and shuffles them into the draw
 * pile. Then deals the numbered piles face down and flips the top card
 * of each numbered pile.
 *
 * @param game The Game object to set up.
 */
function setup_play_area(game) {
    for (let card_type_id of playing_cards.LIBRARY.all_cards) {
        if (!card_type_id.startsWith("Joker")) { // we'll leave the jokers out
            let card = game.create_card(card_type_id);
            game.put_card_on_pile(card, "draw");
        }
    }

    // Shuffle the draw pile and deal cards to each numbered pile
    game.shuffle_pile("draw");
    for (let n = 1; n <= 7; n += 1) {
        let target = "n" + n;

        // Deal n cards into the nth pile
        for (let h = 1; h <= n; h += 1) {
            let next = game.top_card_of_pile("draw");
            game.put_card_on_pile(next, target);
        }

        // Flip the top card of the pile we just dealt
        game.flip_card(game.top_card_of_pile(target));
    }

    // ready to play!
}


/**
 * Determine whether a card from a numbered pile can be played (along
 * with the cards above it, as a stack)
 *
 * @param game The Game object to work with.
 * @param card The card to check.
 */
function card_heads_valid_stack(game, card) {
    let pos = game.position_in_pile(card);
    if (pos == undefined) { // it's not in a pile.
        return false;
    }
    let size = game.pile_size(card.pile);
    if (pos == size) {
        return true;
    } else {
        let last_color = playing_cards.card_color(card);
        for (let opos = pos + 1; opos < size; opos += 1) {
            let here = game.get_card_in_pile(card.pile, opos);
            let here_color = playing_cards.card_color(here);
            if (here_color == last_color) {
                return false;
            }
            last_color = here_color;
        }
        return true;
    }
}

/*
 * Determines whether a card is playable.
 *
 * @param game The game in progress.
 * @param card The card to check.
 *
 */
function card_is_playable(game, card) {
    if (!card.pile || !card.face_up) {
        // There shouldn't be any cards that aren't in a pile, but any of
        // those plus any face-down cards can't be played.
        return false;
    }
    let pile = card.pile;
    if (game.pile_is_in_group(pile, "numbered")) {
        // Any valid stack from a numbered pile may be played
        if (card_heads_valid_stack(game, card)) {
            // This function takes all cards above the target in its pile
            // and stacks them onto it, in preparation for the stack
            // being moved along with the target card.
            return function (game, card) {
                let target_index = game.position_in_pile(card);
                for (
                    let idx = target_index + 1;
                    idx < game.pile_size(card.pile);
                    idx += 1
                ) {
                    let above = game.get_card_in_pile(card.pile, idx);
                    game.stack_card_on_card(above, card);
                }
                // We return a cleanup function to unstack things post-drag.
                return function (game, card) {
                    game.unstack_all_from(card);
                }
            };
        }
    } else if (pile == "drawn" || game.pile_is_in_group(pile, "top")) {
        // The top card from the drawn pile or any top pile may be
        // played.
        return game.card_is_on_top_of_pile(card, pile);
    } else {
        // Any other card may not be played
        return false;
    }
}

/**
 * Determines whether the given card being played can be played onto the
 * target pile (and/or card within that pile).
 *
 * @param game The game state.
 * @param card_being_played The card that the player is dragging.
 * @param target_pile The pile ID over which the card is being dragged.
 * @param target_card The card of which the player is dragging the card
 *     being played. May be undefined if the player is hovering over a
 *     pile but not a card.
 *
 * This function will return either the target_pile, the target_card, or
 * null if neither is a valid target. This version (for solitaire) always
 * returns the pile (if it's valid), never the card.
 */
function play_target(game, card_being_played, target_pile, target_card) {
    if (game.pile_is_in_group(target_pile, "numbered")) {
        // playing onto a numbered pile
        let onto = game.top_card_of_pile(target_pile);
        let my_color = playing_cards.card_color(card_being_played);
        let my_rank = playing_cards.card_rank(card_being_played);
        let target_color = undefined;
        let target_rank = undefined;
        if (onto != undefined) {
            target_color = playing_cards.card_color(onto);
            target_rank = playing_cards.card_rank(onto);
        }

        if (target_color == undefined) {
            // only kings may be played on empty spots
            if (my_rank == 13) {
                return target_pile;
            } else {
                return null;
            }
        // if non-empty, colors must alternate and ranks must decrease
        } else if (
            my_color == target_color
         || target_rank != my_rank + 1
         ) {
            return null;
        } else {
            return target_pile;
        }
    } else if (game.pile_is_in_group(target_pile, "top")) {
        // playing onto a top pile

        // can't play a stack on a top pile
        if (game.card_has_a_stack(card_being_played)) {
            return null;
        }

        let onto = game.top_card_of_pile(target_pile);
        // Play aces only onto empty top piles
        if (onto == undefined) {
            if (playing_cards.card_rank(card_being_played) == 1) {
                return target_pile;
            } else {
                return null;
            }
        }

        // card info for this card and target card
        let my_suit = playing_cards.card_suit(card_being_played);
        let target_suit = playing_cards.card_suit(onto);
        let my_rank = playing_cards.card_rank(card_being_played);
        let target_rank = playing_cards.card_rank(onto);

        // suit must match and rank must increase
        if (
            target_suit != my_suit
         || target_rank != my_rank - 1
        ) {
            return null;
        } else {
            return target_pile;
        }

    } else {
        // can't play on any other piles
        return null;
    }
}

/**
 * What happens when we try to play a card onto a pile. We assume that
 * the target pile is valid (see play_target). Effects are:
 *
 *   1. Putting single cards or entire stacks onto numbered piles that
 *      end with a card one rank above (and the opposite color from) the
 *      card being placed.
 *   2. Putting single cards onto top piles which are one rank above and
 *      the same suit as the top card of that pile.
 */
function play_onto_pile(game, card, pile) {
    // Remember old pile
    let prev_pile = card.pile;

    // Check which kind of pile we're trying to play onto:
    if (game.pile_is_in_group(pile, "numbered")) {
        // Move card + those stacked on it into the target pile
        game.put_stack_on_pile(card, pile);
    } else if (game.pile_is_in_group(pile, "top")) {
        // playing a single card onto a top pile
        game.put_card_on_pile(card, pile);
    } else {
        // shouldn't be possible
        throw Error("Invalid pile target '" + pile + "'.");
    }

    // Flip top card of previous pile face-up if it was a numbered pile
    if (game.pile_is_in_group(prev_pile, "numbered")) {
        let old_top = game.top_card_of_pile(prev_pile);
        if (old_top != undefined) {
            game.flip_card(old_top, true);
        }
    }
}

export var RULES = {
    "piles": [
        "draw",
        "drawn",
        "n1", "n2", "n3", "n4", "n5", "n6", "n7",
        "top1", "top2", "top3", "top4"
    ],
    "pile_groups": {
        "numbered": [ "n1", "n2", "n3", "n4", "n5", "n6", "n7" ],
        "top": [ "top1", "top2", "top3", "top4" ]
    },
    "pile_settings": {
        "draw": {
            "display": cards.styles.deck,
            "actions": [
                cards.actions.flip_into("drawn", 3)
            ]
        },
        "drawn": {
            "display": cards.styles.show_top(3),
            "actions": [
                cards.actions.flip_into("draw", "all")
                    .with_condition(cards.conditions.when_empty("draw"))
                    .with_icon("⭮")
            ]
        },
        ".numbered": {
            "display": cards.styles.stacked
        },
        ".top": {
            "display": cards.styles.show_top(1)
        }
    },
    "phases": [ "turn" ],
    "phase_settings": {
        "turn": {
            "action_limit": undefined,
            "play_limit": 1
        }
    },
    "setup": setup_play_area,
    "playable": card_is_playable,
    "play_target": play_target,
    "play_card": play_onto_pile,
}

export function new_game(play_area) {
    let result = new cards.Game(playing_cards.LIBRARY, RULES, play_area);
    result.reset = function () { result.new_game() };
    result.start = result.reset;
    return result;
}
