/*
 * cards.js
 * Core cards library object definitions and functions. Includes the
 * Library and Game objects as well as "actions" and "styles"
 * 'sub-modules.'
 */

//------------------//
// Helper Functions //
//------------------//

/**
 * Removes the first copy of the target item from the given array. Does
 * nothing if the item is not in the array.
 *
 * @param item The item to be removed.
 * @param array The array to remove from.
 */
function remove_item_from_array(item, array) {
    let idx = array.indexOf(item);
    if (idx >= 0) {
        array.splice(idx, 1);
    }
}

/**
 * Copies a non-recursive object made of JSON stuff (Objects, Arrays,
 * and/or other immutable types). Fails if the object contains nested
 * components more than 100000 deep (at that point we assume we've
 * encountered a recursive object).
 *
 * @param base_object The object to copy.
 * @param depth (optional) Defaults to 0. Tracks recursion depth.
 */
function copy_nonrecursive_obj(base_object, depth) {
    if (depth == undefined) {
        depth = 0;
    } else if (depth > 100000) {
        throw Error("Object is too deep to copy (most likely recursive!)");
    }
    if (typeof base_object !== 'object' || base_object == null) {
        // it's immutable
        return base_object;
    } else if (Array.isArray(base_object)) {
        // An array
        let result = [];
        for (let item of base_object) {
            result.push(copy_nonrecursive_obj(item, depth+1));
        }
        return result;
    } else {
        // An object of some sort
        let result = {};
        for (let key of Object.keys(base_object)) {
            result[key] = copy_nonrecursive_obj(base_object[key], depth+1);
        }
        return result;
    }
}

var CURRENT_CARD_ID = 0;

/**
 * Returns a new unique ID for a card. Simply uses the global
 * CURRENT_CARD_ID variable to return sequential numbers.
 */
function next_card_id() {
    let result = CURRENT_CARD_ID;
    CURRENT_CARD_ID += 1;
    return result;
}

//---------------//
// Library class //
//---------------//

/*
 * Constructs a new Library object, which holds a set of potential cards
 * (card types) for use in one or more Games.
 *
 * @param name The name of this library.
 */
export function Library(name) {
    this.name = name;
    this.card_data = {};
    this.all_cards = [];
    this.group_data = {};
    this.all_groups = [];
}

//-----------------//
// Library methods //
//-----------------//

/**
 * Registers a new type of card under the given (string) ID.
 *
 * @param card_type_id The ID for the card. Must be unique.
 * @param face_html Determines determines the appearance and construction
 *     of the face of the card.
 * @param props Sets the card properties.
 *
 * Use Game.create_card with the card_type_id to create an instance of
 * the new card type.
 */
Library.prototype.register_card = function (card_type_id, face_html, props) {
    if (this.card_data.hasOwnProperty(card_type_id)) {
        throw Error(
            "Card ID '" + card_type_id
          + "' is already registered in this library."
        );
    }
    this.all_cards.push(card_type_id);
    this.card_data[card_type_id] = {
        "id": card_type_id,
        "face": face_html,
        "properties": props
    };
}

/**
 * Creates a group of card types, which can be tested using
 * card_type_belongs_to_group, or a list of card types can be
 * retrieved using all_card_types_in_group.
 *
 * @param group_id The group to create. It must be unique.
 * @param filter A function which will be applied to the properties of
 *     each card in the library. Card types for which it returns true
 *     will be included in the group.
 *
 * Note that if new cards are added to the library after the group is
 * created, they will not be added to existing groups, even if they meet
 * the filter criteria for those groups.
 */
Library.prototype.create_group = function (group_id, filter) {
    if (Object.hasOwnProperty(this.group_data, group_id)) {
        throw Error("Group '" + group_id + "' already exists.");
    }
    let group_members = [];
    for (let card_type_id of this.all_cards) {
        if (filter(this.card_data[card_type_id].properties)) {
            group_members.push(card_type_id);
        }
    }
    this.all_groups.push(group_id);
    this.group_data[group_id] = group_members;
}

/**
 * Returns true if cards of the given type belong to the given
 * card type group.
 *
 * @param card_type The card type to check on.
 * @param group_id The group ID to check for membership of.
 */
Library.prototype.card_type_belongs_to_group = function (card_type, group_id) {
    return this.group_data[group_id].indexOf(card_type) >= 0;
}

/**
 * Returns an array containing all of the card type IDs that
 * belong to the given group.
 *
 * @param group_id The group ID to retrieve a list for.
 */
Library.prototype.all_card_types_in_group = function (group_id) {
    return this.group_data[group_id].slice();
}

//------------//
// Game class //
//------------//


var SETTINGS_KEYS = [
    "display",
    "actions",
    "playable",
    "play_target",
    "play_card",
];

/**
 * Constructs a new Game object, which maintains the state of a single
 * ongoing game.
 *
 * @param library The library to use for this game.
 * @param rules The rules to use for this game.
 * @param play_area The DOM element within which to display cards. This
 *     element should be set to position: relative. Any existing contents
 *     will be deleted.
 *
 * The rules object may have the following keys:
 *
 *   piles - An array of strings specifying the ID of each pile that the
 *       game will use. Pile IDs may not start with periods or asterisks.
 *   pile_groups - A mapping from pile group IDs to arrays of pile IDs
 *       that belong to each group.
 *   pile_settings - A mapping from pile IDs (or pile group IDs preceded
 *       by a period, or '*' for all piles) to pile settings object. 
 *   phases - An array of strings specifying the ID of each phase that
 *       the game will use. Phase IDs may not start with periods or
 *       asterisks.
 *   phase_groups - A mapping from phase group IDs to arrays of phase IDs
 *       that belong to each group.
 *   phase_settings - A mapping from phase IDs (or phase group IDs
 *       preceded by a period, or '*' for all phases) to phase settings
 *       objects.
 *   card_settings - A mapping from card IDs (or card group IDs preceded
 *       by a period, or '*' for all cards) to card settings object. 
 *   setup - A function to be run when a new game is started. When the
 *       setup function is run, the game will be empty. The setup
 *       function should create any cards needed for play and arrange
 *       them into the appropriate piles.
 *   playable - A function to determine whether a card is playable. It
 *       will be given two arguments: a game object and a card object. It
 *       may return true or false to indicate playability, or it may
 *       return a pre-pickup function that indicates that the card is
 *       playable, but before being picked up that function should be
 *       run. This can be used for example to stack cards when a card is
 *       picked up.
 *   play_target - A function to determine valid targets for playing a
 *       card that the player is holding. It will be given four
 *       arguments: a game object, the card the player is holding, the
 *       pile over which the player is hovering, and the card over which
 *       the player is hovering. The last argument will be undefined when
 *       the player is hovering over a pile but not over any specific
 *       card in that pile. This function should return null if the
 *       specified pile and/or card are not valid targets, or either that
 *       pile or that card if one of them is a valid target. In theory it
 *       could return another pile or card; whatever pile or card it
 *       returns will be highlighted as the current drop target.
 *   play_card - A function to update the game state when a card is
 *       played. It will be given four arguments: the game object, the
 *       card being played, and the target pile that was returned
 *       from play_target, and the target card that was returned from
 *       play_target. If play_target returns a pile, the fourth argument
 *       will be undefined. If it returns a card, the third argument will
 *       be the pile that that card is in, or undefined if that card is
 *       not in a pile. It can count on the fact that the target it is
 *       given was returned from play_target, so it should not have to
 *       check the validity of its target.
 *
 * A settings object for a pile, phase, or card, can have the following keys:
 *
 *   display - A style object (see the styles variable below) that
 *       determines how a pile (or phase or card) will be displayed.
 *   actions - An array of action objects (see the actions variable below)
 *       that can be triggered for the given card, pile, or phase. These
 *       can be triggered automatically or triggered by the player.
 *   playable - A function to determine whether a card is playable,
 *       with the same setup as the playable function for the rules in
 *       general. Will override that general function for the specific
 *       card, pile, or phase that it's associated with.
 *   play_target - Just like playable, an override for this
 *       card/pile/phase to determine the target of a card being dragged.
 *   play_card - Just like playable and play_target, an override for this
 *       card/pile/phase to determine the effect of a card being played
 *       on a specific pile and/or card.
 *
 * Settings for phases may also have these keys:
 *
 *   action_limit - A number that limits the number of card/pile/phase
 *       actions the player may initiate during this phase.
 *       TODO: Instead of a number, this may be a function to be called
 *       after each action is taken, which may return true to continue
 *       the phase or false to end it. The function will be given the
 *       game object.
 *   play_limit - A number that limits the number of cards that the
 *       player may play during this phase.
 *       TODO: Instead of a number, this may be a function to be called
 *       after each card is played, which may return true to continue the
 *       phase or false to end it. The function will be given the game
 *       object.
 */
export function Game(library, rules, play_area) {
    this.library = library;
    this.rules = rules;
    this.play_area = play_area;
    this.play_area.classList.add("play_area");

    this.existing_cards = [];
    this.piles = {};
    this.pile_groups = {};

    for (let pile_id of this.rules.piles) {
        this.create_pile(pile_id);
    }

    for (let pile_group_id of Object.keys(this.rules.pile_groups)) {
        for (let pile_id of this.rules.pile_groups[pile_group_id]) {
            this.add_pile_to_group(pile_id, pile_group_id);
        }
    }

    // Apply pile settings
    if (this.rules.pile_settings) {

        // First sort the pile settings into global, per-group, and
        // per-pile settings, so that more-specific settings override
        // less-specific settings.
        let all_pile_settings = null;
        let pile_group_settings = {};
        let single_pile_settings = {};
        for (let pile_id of Object.keys(this.rules.pile_settings)) {
            let settings = this.rules.pile_settings[pile_id];
            if (pile_id == "*") {
                // applies to all piles
                all_pile_settings = settings;
            } else if (pile_id.startsWith('.')) {
                // applies to a group of piles
                let pile_group_id = pile_id.slice(1);
                pile_group_settings[pile_group_id] = settings;
            } else {
                // just applies to a single pile
                single_pile_settings[pile_id] = settings;
            }
        }

        // Apply universal pile settings
        if (all_pile_settings) {
            for (let pile_id of Object.keys(this.piles)) {
                let pile_obj = this.piles[pile_id];
                for (let key of SETTINGS_KEYS) {
                    if (all_pile_settings.hasOwnProperty(key)) {
                        pile_obj[key] = all_pile_settings[key];
                    }
                }
            }
        }

        // Apply pile group settings
        for (let pile_group_id of Object.keys(pile_group_settings)) {
            let settings_to_apply = pile_group_settings[pile_group_id];
            for (let pile_id of this.all_piles_in_group(pile_group_id)) {
                let pile_obj = this.piles[pile_id];
                for (let key of SETTINGS_KEYS) {
                    if (settings_to_apply.hasOwnProperty(key)) {
                        pile_obj[key] = settings_to_apply[key];
                    }
                }
            }
        }

        // Apply individual pile settings
        for (let pile_id of Object.keys(single_pile_settings)) {
            let settings_to_apply = single_pile_settings[pile_id];
            let pile_obj = this.piles[pile_id];
            for (let key of SETTINGS_KEYS) {
                if (settings_to_apply.hasOwnProperty(key)) {
                    pile_obj[key] = settings_to_apply[key];
                }
            }
        }
    }

    // Apply display rules for each pile
    for (let pile_id of Object.keys(this.piles)) {
        let pile_obj = this.piles[pile_id];
        if (pile_obj.hasOwnProperty("display")) {
            pile_obj.display(pile_obj.element);
        }
    }

    // TODO: Create UI elements for pile actions...

    // Apply phase settings
    // TODO

    // Apply card settings
    // TODO
}

//--------------//
// Game methods //
//--------------//

// Pile actions
//-------------

/**
 * Creates a new pile with the given ID (must be unique).
 *
 * @param pile_id The ID for the pile to be created.
 */
Game.prototype.create_pile = function (pile_id) {
    // Create a div for this pile
    let element = document.createElement("div");
    element.classList.add("pile");
    element.classList.add("pile_" + pile_id);

    // Add it to the play area
    this.play_area.appendChild(element);

    // Add an entry in the piles map for the new pile
    this.piles[pile_id] = {
        "id": pile_id,
        "element": element,
        "items": [],
        "display": styles.stacked,
        "actions": [],
    };
}

/**
 * Deletes a pile. Any cards in that pile will be rendered pile-less.
 *
 * @param pile_id The ID of the pile to be deleted.
 */
Game.prototype.delete_pile = function (pile_id) {
    // Remove all cards in this pile first
    for (let card of this.piles[pile_id].items) {
        this.remove_card_from_pile(card);
    }

    // Remove the pile element from the DOM
    let pile_obj = this.piles[pile_id];
    let elem = pile_obj.element;
    elem.parentNode.removeChild(elem);

    // Remove entires for the pile ID from this.piles and this.pile_groups
    delete this.piles[pile_id];
    delete this.pile_groups[pile_id];
}

/**
 * Adds the pile with the given ID to the given pile group. Creates the
 * group if it didn't already exist. It's possible for a pile to be in
 * multiple groups at once. Does nothing if the target pile is already in
 * the target group.
 *
 * @param pile_id The ID of the pile to place in a group.
 * @param pile_group_id The ID of the group to add the pile to.
 */
Game.prototype.add_pile_to_group = function (pile_id, pile_group_id) {
    if (this.pile_is_in_group(pile_id, pile_group_id)) {
        return; // already in there
    }
    let groups_for_pile;
    if (this.pile_groups.hasOwnProperty(pile_id)) {
        groups_for_pile = this.pile_groups[pile_id];
    } else {
        groups_for_pile = [];
        this.pile_groups[pile_id] = groups_for_pile;
    }
    groups_for_pile.push(pile_group_id);
    let pile_obj = this.piles[pile_id];
    pile_obj.element.classList.add("pile_group_" + pile_group_id);
}

/**
 * Removes the pile with the given pile ID from the specified pile group.
 * Does nothing if that pile isn't currently in that group.
 *
 * @param pile_id The ID of the pile to remove from a group.
 * @param pile_group_id The ID of the group that the pile should be
 *     removed from.
 */
Game.prototype.remove_pile_from_group = function (pile_id, pile_group_id) {
    let groups_for_pile = this.pile_groups[pile_id];
    remove_item_from_array(pile_group_id, groups_for_pile);
    let pile_obj = this.piles[pile_id];
    pile_obj.element.classList.remove("pile_group_" + pile_group_id);
}

/**
 * Returns true if the pile with the given ID is in the given pile group.
 *
 * @param pile_id The ID of the pile to check.
 * @param pile_group_id The ID of the group to check for.
 */
Game.prototype.pile_is_in_group = function (pile_id, pile_group_id) {
    let groups_for_pile = this.pile_groups[pile_id];
    if (!groups_for_pile) {
        return false;
    }
    return groups_for_pile.indexOf(pile_group_id) >= 0;
}

/**
 * Returns an array containing all piles that are in the given pile
 * group.
 *
 * @param pile_group_id The ID of the group to retrieve.
 */
Game.prototype.all_piles_in_group = function (pile_group_id) {
    let result = [];
    for (let grouped_pile_id of Object.keys(this.pile_groups)) {
        if (this.pile_groups[grouped_pile_id].indexOf(pile_group_id) >= 0) {
            result.push(grouped_pile_id);
        }
    }
    return result;
}

// Card actions
//-------------

/**
 * Creates an instance of the given card type. Returns the card object
 * that it creates, which will be face-down by default. It will not be
 * placed into any pile.
 *
 * @pram card_type_id The card type to use as the template for this card.
 * @param face_up_or_false (optional) Defaults to false. If true, the
 *     created card will be face-up.
 */
Game.prototype.create_card = function (card_type_id, face_up_or_false) {
    let is_face_up = false;
    if (face_up_or_false) {
        is_face_up = true;
    }
    // Card data from the library
    let card_data = this.library.card_data[card_type_id];

    // HTML DOM element for this card
    let element = document.createElement("div");
    element.classList.add("card");
    if (is_face_up) {
        element.classList.add("faceup");
    } else {
        element.classList.add("facedown");
    }

    // The front of the card (visible when face-up)
    let front = document.createElement("div");
    front.classList.add("front");
    front.innerHTML = card_data.face;

    // The back of the card (visible when face-down)
    let back = document.createElement("div");
    back.classList.add("back");
    if (card_data.back) {
        back.innerHTML = card_data.back;
    } else {
        // TODO: Generic backing here
        back.innerHTML = "";
    }

    // Add front and back to the card
    element.appendChild(back);
    element.appendChild(front);

    // Return a new card
    return {
        "id": next_card_id(),
        "type": card_data.id,
        "face_up": is_face_up,
        "properties": copy_nonrecursive_obj(card_data.properties),
        "element": element
    }
}

/**
 * Removes the given card from the pile that it is in. Does nothing if
 * the card is not in any pile.
 *
 * @param card The card to remove (from the pile it is currently in).
 */
Game.prototype.remove_card_from_pile = function (card) {
    let prev_pile = card.pile;
    if (prev_pile) {
        remove_item_from_array(card, this.piles[prev_pile].items);
        card.element.parentNode.removeChild(card.element);
        delete card.pile;
    }
}

/**
 * Stacks the first card onto the second card, on top of any cards
 * already stacked on that card. If the first card is already stacked on
 * another card, it is removed from that stack. No matter where the first
 * card was beforehand, afterwards it will be in the same pile as the
 * second card directly above it (and any other stacked cards). If the
 * card being stacked onto is not in a pile, the card being stacked will
 * be removed from its pile.
 *
 * @param card_to_stack The card being moved.
 * @param stack_onto The card being stacked onto.
 */
Game.prototype.stack_card_on_card = function (card_to_stack, stack_onto) {
    this.remove_card_from_pile(card_to_stack);
    this.unstack_card(card_to_stack);
    if (stack_onto.pile) {
        this.insert_card_into_pile_after(
            card_to_stack,
            stack_onto
        );
    }
    card_to_stack.stacked_on = stack_onto;
    if (stack_onto.stack) {
        stack_onto.stack.push(card_to_stack);
    } else {
        stack_onto.stack = [ card_to_stack ];
    }
}

/**
 * Inserts the given card into the same pile as the target card, directly
 * after it and any cards that are stacked on it. Any cards stacked on
 * the target card fall off (but see insert_stack_into_pile_after).
 *
 * @param card The card being inserted.
 * @param insert_after The card after which to insert. The pile that this
 *     card is in determines the pile being inserted into.
 */
Game.prototype.insert_card_into_pile_after = function (card, insert_after) {
    this.remove_card_from_pile(card);
    this.unstack_card(card);
    let base_idx = this.position_in_pile(insert_after);
    let insert_at = base_idx + 1;
    if (insert_after.stack) {
        insert_at += insert_at.stack.length;
    }
    let pile_obj = this.piles[insert_after.pile];

    // Put it into the pile's array
    let pile_items = pile_obj.items;
    pile_items.splice(insert_at, 0, [card]);

    // Put it into the pile's DOM
    pile_obj.element.insertBefore(
        card.element,
        insert_after.element.nextSibling
    );
}

/**
 * Removes the target card from the stack it is a part of, placing it
 * after any other cards in that stack within the pile that that stack
 * was part of. Does nothing if the target card is not stacked on another
 * card.
 *
 * TODO: Stacking effects on DOM?
 *
 * @param card The card being removed from a stack.
 */
Game.prototype.unstack_card = function (card) {
    let pile = card.pile;
    let stacked_on = card.stacked_on;
    if (!stacked_on) {
        return;
    }
    delete card.stacked_on;
    remove_item_from_array(card, stacked_on.stack);
    if (stacked_on.stack.length == 0) {
        // last in stack, so let't get rid of the stack
        delete stacked_on.stack;
    } else {
        // other still in stack, so let's move ourselves after them
        if (pile) {
            // re-insert it to 
            this.remove_card_from_pile(card);
            this.insert_card_into_pile_after(card, stacked_on);
        }
    }
}

/**
 * Unstacks all cards stacked on the target card, leaving them in their
 * original order. Does nothing if there are no cards stacked on the
 * target card. If the target card is in turn part of a stack on top of
 * another base card, that stack is not affected.
 *
 * @param stack_base The card from which stacked cards should be unstacked.
 */
Game.prototype.unstack_all_from = function (stack_base) {
    // Reverse order is important here because unstack can reorder things
    if (stack_base.stack) {
        let stacked = stack_base.stack.slice().reverse();
        if (stacked) {
            for (let in_stack of stacked) {
                this.unstack_card(in_stack);
            }
        }
    }
}

/**
 * Puts the given card on top of the pile with the given ID. Removes it
 * from any previous pile it was in, and any cards that are stacked on it
 * fall off.
 *
 * @param card The card being moved.
 * @param pile_id The pile ID of the pile to put that card on.
 */
Game.prototype.put_card_on_pile = function (card, pile_id) {
    this.unstack_all_from(card);
    this.remove_card_from_pile(card);
    card.pile = pile_id;
    this.piles[pile_id].items.push(card);
    this.piles[pile_id].element.appendChild(card.element);
}

/**
 * Puts a card on top of the pile with the given ID, and then puts any
 * cards that were stacked on top of the given card into the same pile
 * above the target card in the order that they are stacked. The stacked
 * cards remain stacked on the target card. Recursively handles any cards
 * that might have been stacked on cards which are stacked on the target
 * card.
 *
 * @param card The base of the stack being moved.
 * @param pile_id The pile to move the stack onto.
 */
Game.prototype.put_stack_on_pile = function (card, pile_id) {
    this.put_card_on_pile(card, pile_id);
    if (card.stack) {
        for (let stacked of card.stack) {
            this.put_stack_on_pile(stacked, pile_id);
        }
    }
}

/**
 * Fisher-Yates shuffle (Durstenfeld version) from:
 * https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
 *
 * @param pile_id The pile to shuffle.
 */
Game.prototype.shuffle_pile = function (pile_id) {
    let pile_obj = this.piles[pile_id];
    let pile_items = pile_obj.items;
    for (var i = pile_items.length - 1; i > 0; i -= 1) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = pile_items[i];
        pile_items[i] = pile_items[j];
        pile_items[j] = temp;
    }

    // TODO: Shuffle DOM elements...
    let pile_element = pile_obj.element;
}

/**
 * Flips a card to be either face up (true) or face down (false).
 *
 * @param card The card to flip.
 * @param put_face_up (opitonal) If not specified, the card will flip to
 *     the opposite of its current state. If specified as true, the card
 *     will be face-up, and if false, it will be face-down.
 */
Game.prototype.flip_card = function (card, put_face_up) {
    if (put_face_up == undefined) {
        card.face_up = !card.face_up
    } else {
        card.face_up = put_face_up;
    }

    // Update element classes for CSS
    if (card.face_up) {
        card.element.classList.remove("facedown")
        card.element.classList.add("faceup")
    } else {
        card.element.classList.remove("faceup")
        card.element.classList.add("facedown")
    }
}

// State Functions
//----------------

/**
 * Returns the card in the pile with the given ID that's at the given
 * index (0 is the first index in the pile). Returns undefined if there
 * is no card at the given index.
 *
 * @param pile_id The ID of the pile to index.
 * @param position The index in that pile (starting from 0).
 */
Game.prototype.get_card_in_pile = function (pile_id, position) {
    let pile_items = this.piles[card.pile].items;
    return pile_items[position];
}

/**
 * Returns an array containing all of the cards in the given pile.
 *
 * @param pile_id the ID of the pile to retrieve.
 */
Game.prototype.all_cards_in_pile = function (pile_id) {
    return this.piles[pile_id].items.slice();
}

/**
 * Returns the top card of the pile with the given ID. Returns undefined
 * if the pile is empty.
 *
 * @param pile_id the pile to retrieve from.
 */
Game.prototype.top_card_of_pile = function (pile_id) {
    let pile_items = this.piles[pile_id].items;
    return pile_items[pile_items.length - 1];
}

/**
 * Returns the bottom card of the pile with the given ID. Returns
 * undefined if the pile is empty.
 *
 * @param pile_id the pile to retrieve from.
 */
Game.prototype.bottom_card_of_pile = function (pile_id) {
    let pile_items = this.piles[pile_id].items;
    return pile_items[0];
}

/**
 * Returns the position that the given card occupies within its current
 * pile, as a zero-based index. Returns undefined if the card is not in a
 * pile.
 *
 * @param card The card to check.
 */
Game.prototype.position_in_pile = function (card) {
    if (!card.pile) {
        return undefined;
    }
    let pile_items = this.piles[card.pile].items;
    return pile_items.indexOf(card);
}

/**
 * Returns the number of cards in the pile with the given ID.
 *
 * @param pile_id The ID of the pile to inspect.
 */
Game.prototype.pile_size = function (pile_id) {
    let pile_items = this.piles[pile_id].items;
    return pile_items.length;
}

/**
 * Returns true if the given card has other cards stacked on it, and
 * false otherwise.
 *
 * @param card The card to check.
 */
Game.prototype.card_has_a_stack = function (card) {
    if (card.stack) {
        return true;
    } else {
        return false;
    }
}

// High level game actions
//------------------------

/**
 * Starts a new game, resetting any current game state, and calling the
 * setup function specified by the game rules. Currently existing cards
 * are destroyed, and all piles are emptied. If the rules for this game
 * include a cleanup function, that function is run before any changes
 * are made to cards or piles. A cleanup function should do things like
 * removing any dynamically-created piles, as these won't be reset
 * automatically (pile contents are emptied, but no existing piles are
 * automatically destroyed).
 */
Game.prototype.new_game = function () {
    if (this.rules.cleanup) {
        this.rules.cleanup(this);
    }

    // Removes references to existing cards
    this.existing_cards = [];

    // Erase all cards from all piles
    for (let pile_id of Object.keys(this.piles)) {
        let pile_obj = this.piles[pile_id];
        pile_obj.items = [];
        pile_obj.element.innerHTML = "";
    }

    // TODO: Cleanup on UI/DOM side of things?!

    // Call the setup function now that everything has been reset
    if (this.rules.setup) {
        this.rules.setup(this);
    }
}


// UI Backend
//-----------

// TODO

// UI Functions
//-------------

// TODO

//--------------------//
// Predefined Actions //
//--------------------//

export var actions = {
    "draw_into": function (dest_pile_id, num_cards_or_1) {
    },
    "flip_into": function (dest_pile_id, num_cards_or_1) {
    },
    "shuffle_into": function (dest_pile_id, num_cards_or_all) {
    },
}

//------------------------------//
// Predefined Action Conditions //
//------------------------------//

export var conditions = {
    "when_empty": function(pile_id, action) {
    },
    "general": function(test, action) {
    },
}

//---------------------------------//
// Predefined Pile and Card Styles //
//---------------------------------//

export var styles = {
    "deck": function (pile_div) {
        pile_div.classList.add("deck");
    },
    "stacked": function (pile_div) {
        pile_div.classList.add("stacked");
    },
    "show_top": function(number_to_show) {
        return function (pile_div) {
            pile_div.classList.add("show_top");
            pile_div.classList.add("show_" + number_to_show);
        }
    },
    //"stacked": ...
}
