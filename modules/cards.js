/*
 * cards.js
 * Core cards library object definitions and functions. Includes the
 * Library and Game objects as well as "actions" and "styles"
 * 'sub-modules.'
 */

import * as unit from './unit.js'

//------------------//
// Helper Functions //
//------------------//

/**
 * Removes the first copy of the target item from the given array. Does
 * nothing if the item is not in the array. Does not work for objects
 * unless the target object is actually in the array, rather than merely
 * being a clone of something that's in the array.
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


/**
 * The keys which can be applied to a pile via pile settings.
 */
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
 *       return a pre-consideration function that indicates that the card
 *       is playable, but before being considered for play, that function
 *       should be run. The pre-consideration function will be given a
 *       game object and a card object as arguments, and its return value
 *       may be a cleanup function which takes the same arguments and
 *       which will be called after a move has been made or if the player
 *       cancels a potential move. This can be used for example to stack
 *       cards when a card is being considerd for play, and then unstack
 *       them after the card is played.
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
 *       returns will be established as the current play target.
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
    // configuration variables
    this.library = library;
    this.rules = rules;
    this.play_area = play_area;
    this.play_area.classList.add("play_area");

    // entity variables
    this.existing_cards = [];
    this.piles = {};
    this.pile_groups = {};

    // UI variables
    this.drag_handlers = create_drag_handlers(this);
    this.considering = null;
    this.play_cleanup = null;
    this.potential_target_pile = null;
    this.potential_target_card = null;

    // Add drag handlers to the play area
    play_area.addEventListener("dragstart", this.drag_handlers[0]);
    play_area.addEventListener("dragend", this.drag_handlers[1]);
    play_area.addEventListener("dragenter", this.drag_handlers[2]);
    play_area.addEventListener("dragleave", this.drag_handlers[3]);
    play_area.addEventListener("drag", this.drag_handlers[4]);
    play_area.addEventListener("dragover", this.drag_handlers[5]);
    play_area.addEventListener("drop", this.drag_handlers[6]);

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
                this.apply_pile_settings(pile_id, all_pile_settings);
            }
        }

        // Apply pile group settings
        for (let pile_group_id of Object.keys(pile_group_settings)) {
            let settings_to_apply = pile_group_settings[pile_group_id];
            for (let pile_id of this.all_piles_in_group(pile_group_id)) {
                this.apply_pile_settings(pile_id, settings_to_apply);
            }
        }

        // Apply individual pile settings
        for (let pile_id of Object.keys(single_pile_settings)) {
            let settings_to_apply = single_pile_settings[pile_id];
            this.apply_pile_settings(pile_id, settings_to_apply);
        }
    }

    // Apply phase settings
    // TODO

    // Apply card settings
    // TODO
}

//--------------//
// Game methods //
//--------------//

// Setup
//------

/**
 * Takes a pile settings object and applies it to the pile with the given
 * ID, updating the pile's properties but also taking care of updating
 * the pile's HTML element to reflect the new properties (for example by
 * creating buttons for each action or applying a new display style).
 * Only keys in the SETTINGS_KEYS list will be applied to the pile, so
 * for example you cannot use this function to change a pile's ID.
 *
 * @param pile_id The pile to apply settings to.
 * @param settings The settings object.
 */
Game.prototype.apply_pile_settings = function (pile_id, settings) {
    let the_game = this; // for scope penetration into event handlers
    let pile_obj = this.piles[pile_id];
    for (let key of SETTINGS_KEYS) {
        if (settings.hasOwnProperty(key)) {
            pile_obj[key] = settings[key];
        }
        if (key == "display") {
            pile_obj.display(pile_obj.element);
        } else if (key == "actions") {
            let actions_span = pile_obj.element.querySelector(".actions");
            actions_span.innerHTML = "";
            for (let action of pile_obj.actions) {
                let button = document.createElement("a");
                button.innerHTML = action.icon;
                button.addEventListener("click", function () {
                    if (action.condition != undefined) {
                        if (!action.condition(the_game, pile_id)) {
                            return; // do nothing if condition is not met
                            // TODO: Update UI to gray out actions with
                            // unmet conditions!
                        }
                    }
                    // Perform the action
                    action.perform(the_game, pile_id);
                    // TODO: UI update cycle probably needed here!
                });
                actions_span.appendChild(button);
            }
        }
    }
}

// Pile actions
//-------------

/**
 * Creates a new pile with the given ID (must be unique).
 *
 * @param pile_id The ID for the pile to be created (a string).
 */
Game.prototype.create_pile = function (pile_id) {
    // Create a div for this pile
    let element = document.createElement("div");
    element.classList.add("pile");
    element.classList.add("pile_" + pile_id);
    element.setAttribute("data-pile-id", pile_id);

    // Add it to the play area
    this.play_area.appendChild(element);

    // Add inner divs for cards and controls
    let cards = document.createElement("div");
    cards.classList.add("pilecards");
    element.appendChild(cards);

    let controls = document.createElement("div");
    controls.classList.add("controls");
    element.appendChild(controls);

    /*
    let controls_button = document.createElement("a");
    controls_button.innerHTML = "☰";
    controls.appendChild(controls_button);
    */

    // Default controls
    let inspect = document.createElement("a");
    //inspect.setAttribute("href", "#inspect:" + pile_id);
    inspect.setAttribute("title", "Inspect pile");
    inspect.innerHTML = "🔍";
    let the_game = this;
    inspect.addEventListener(
        "click",
        function () {
            the_game.inspect_pile(pile_id);
        }
    );

    controls.appendChild(inspect);

    // Room for actions within the pile controls
    let actions = document.createElement("span");
    actions.classList.add("actions");
    controls.appendChild(actions);

    // Add an entry in the piles map for the new pile
    this.piles[pile_id] = {
        "id": pile_id,
        "element": element,
        "cards_element": cards,
        "items": [],
        "display": styles.stacked,
        "actions": [],
    };
}

/**
 * Deletes a pile. Any cards in that pile will be rendered pile-less.
 * This does not alter the stack situation of affected cards.
 *
 * @param pile_id The ID of the pile to be deleted.
 */
Game.prototype.delete_pile = function (pile_id) {
    // Remove all cards in this pile first
    for (let card of this.piles[pile_id].items) {
        this._remove_card_from_pile(card);
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

    // Make the card draggable
    element.setAttribute("draggable", "true");

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

    // Create a new card object
    let result = {
        "id": next_card_id(),
        "type": card_data.id,
        "face_up": is_face_up,
        "properties": copy_nonrecursive_obj(card_data.properties),
        "element": element
    }

    // Add a reference to the card object to the card DIV so events can
    // access it
    element.card = result;

    // Add this card to the array of existing cards
    this.existing_cards.push(result);

    // Return the new card
    return result;
}

/**
 * Internal function for removing a card from a pile without affecting
 * its stacking situation.
 *
 * @param card The card to remove (from the pile it is currently in).
 */
Game.prototype._remove_card_from_pile = function (card) {
    let prev_pile = card.pile;
    if (prev_pile) {
        remove_item_from_array(card, this.piles[prev_pile].items);
        card.element.parentNode.removeChild(card.element);
        delete card.pile;
    }
}

/**
 * Returns the stack root of the given card. The "orig" argument should
 * be omitted, as it is used only for recursive purposes.
 *
 * If a card is not stacked, its stack root is itself. If it is stacked,
 * its stack root is the stack root of the card that it is stacked on,
 * which could be that card, or could be another card which that card is
 * itself stacked on (stacks can form tree-like structures).
 *
 * If a card is involved in a circular stacking structure, its ultimate
 * root is the card that it is stacked on.
 */
Game.prototype.stack_root = function (card, orig) {
    if (!card.stacked_on) {
        return card;
    } else if (card === orig) { // circular stacking situation
        return card.stacked_on;
    } else {
        if (orig == undefined) { orig = card; }
        return this.stack_root(card.stacked_on, orig);
    }
}

/**
 * Returns true if the given ancestor card appears somewhere among the
 * stack ancestors of the given card. Stack ancestors include the card
 * itself, plus the stack ancestors of the card it is stacked on.
 */
Game.prototype.has_stack_ancestor = function (card, ancestor) {
    if (card === ancestor) {
        return true;
    } else if (card.stacked_on) {
        return this.has_stack_ancestor(card.stacked_on, ancestor);
    } else {
        return false;
    }
}

/**
 * Works like _remove_card_from_pile, but also removes any cards stacked
 * on that card, recursively. Does not affect stacking relationships at
 * all, and thus can cause cross-pile stacking to occur, so don't use
 * this function directly.
 *
 * @param card The base of the stack to remove (from the pile it is
 *     currently in).
 */
Game.prototype._remove_stack_from_pile = function (card) {
    this._remove_card_from_pile(card);
    if (card.stack) {
        for (let stacked of card.stack) {
            this._remove_stack_from_pile(stacked);
        }
    }
}

/**
 * Removes the given card from the pile that it is in. Any cards stacked
 * on the given card fall off, and it is unstacked from any card that it
 * was stacked on (even if it wasn't in a pile to begin with).
 *
 * @param card The card to remove (from the pile it is currently in).
 */
Game.prototype.remove_card_from_pile = function (card) {
    this.unstack_all_from(card);
    this.unstack_card(card);
    this._remove_card_from_pile(card);
}

/**
 * Removes the card and any cards stacked on it (recursively) from the
 * pile that they're in. The cards stacked onto the target card remain
 * stacked on it, but it is removed from the stack of any card that it
 * was stacked on (even if they're already not in any pile).
 */
Game.prototype.remove_stack_from_pile = function (card) {
    this._unstack_card(card);
    this._remove_stack_from_pile(card);
}

/**
 * Internal function to stack cards without moving them.
 *
 * @param card_to_stack The card being added to a stack.
 * @param stack_onto The card being stacked onto.
 */
Game.prototype._stack_cards = function (card_to_stack, stack_onto) {
    card_to_stack.stacked_on = stack_onto;
    if (stack_onto.stack) {
        stack_onto.stack.push(card_to_stack);
    } else {
        stack_onto.stack = [ card_to_stack ];
    }
}

/**
 * Stacks the first card onto the second card, on top of any cards
 * already stacked on that card. If the first card is already stacked on
 * another card, it is removed from that stack. No matter where the first
 * card was beforehand, afterwards it will be in the same pile as the
 * second card directly above it (and any other stacked cards). Any cards
 * stacked on the card being stacked will move with it.
 *
 * If the card being stacked onto is not in a pile, the card being
 * stacked will be removed from its pile.
 *
 * @param card_to_stack The card being moved.
 * @param stack_onto The card being stacked onto.
 *
 * Note: If the card being stacked onto is in a stack that's on the card
 * being stacked, a circular stacking situation will result. You
 * *probably* want to avoid that?
 */
Game.prototype.stack_card_on_card = function (card_to_stack, stack_onto) {
    if (card_to_stack === stack_onto) {
        throw InternalError("Can't stack a card onto itself!");
    }
    this._unstack_card(card_to_stack);
    if (stack_onto.pile) {
        this.insert_stack_into_pile_after(
            card_to_stack,
            stack_onto
        );
    } else {
        this._remove_stack_from_pile(card_to_stack);
    }
    this._stack_cards(card_to_stack, stack_onto);
}

/**
 * Inserts the given card and any cards stacked on top of it into the
 * same pile as the target card, directly after it and any cards that are
 * stacked on it. Cards stacked on (not above) the target card come with
 * it, including cards recursively stacked on those cards. If the card
 * being moved was stacked on a card, that relationship is severed unless
 * the card that it was stacked on ends up in the same pile.
 *
 * @param card The card being inserted.
 * @param insert_after The card after which to insert. The pile that this
 *     card is in determines the pile being inserted into.
 *
 * Note: If the card being inserted after has the card being moved as a
 * stack ancestor (and thus would be itself moved by the operation),
 * the operation doesn't make any sense, and so nothing will happen (and
 * an error will be issued in the console).
 *
 * Note 2: It is possible that the card being inserted after is a stack
 * sibling of the card being moved, and thus will fall down as a result
 * of the movement, but this is fine. This kind of within-pile movement
 * may end up in a situation where the pile order of cards is different
 * from their stack order, but that is permissible.
 */
Game.prototype.insert_stack_into_pile_after = function (card, insert_after) {
    if (this.has_stack_ancestor(insert_after, card)) {
        console.error(
            "Attempted to insert a stack into a pile after a card that "
          + "was part of that stack! (" + card.type + " onto "
          + insert_after.type + ")"
        );
        return;
    }
    // Remove card + its stack from current pile
    this._remove_stack_from_pile(card);
    // Unstack card if it's going to end up in a different pile than the
    // card it is currently stacked on.
    if (card.stacked_on && card.stacked_on.pile != insert_after.pile) {
        this._unstack_card(card);
    }

    // Figure out where to insert in target pile
    let base_idx = this.position_in_pile(insert_after);
    let insert_at = base_idx + 1;
    if (insert_after.stack) {
        insert_at += insert_after.stack.length;
    }
    let pile_obj = this.piles[insert_after.pile];

    // Insert into the pile's array
    let pile_items = pile_obj.items;
    pile_items.splice(insert_at, 0, card);

    // Set the card's pile property
    card.pile = insert_after.pile;

    // Put this card into pile's DOM
    pile_obj.cards_element.insertBefore(
        card.element,
        insert_after.element.nextSibling
    );

    // Recursively handle any cards stacked on this one, re-stacking them
    // after the card we just moved. This operation won't unstack them
    // because they are being moved into the same pile as the card that
    // they're stacked on.
    if (card.stack) {
        for (let stacked of card.stack) {
            this.insert_stack_into_pile_after(stacked, card);
        }
    }
}

/**
 * Inserts the given card into the same pile as the target card, directly
 * after it and any cards that are stacked on it. Any cards stacked on
 * the target card fall off, and if it was stacked on another card that
 * relationship is severed (but see insert_stack_into_pile_after).
 *
 * @param card The card being inserted.
 * @param insert_after The card after which to insert. The pile that this
 *     card is in determines the pile being inserted into.
 */
Game.prototype.insert_card_into_pile_after = function (card, insert_after) {
    this._unstack_card(card);
    this.unstack_all_from(card);
    this.insert_stack_into_pile_after(card, insert_after);
}

/**
 * Puts the given card on top of the pile with the given ID. Removes it
 * from any previous pile it was in, any cards that are stacked on it
 * fall off, and it is removed from any stack that it was a part of.
 *
 * @param card The card being moved.
 * @param pile_id The pile ID of the pile to put that card on.
 */
Game.prototype.put_card_on_pile = function (card, pile_id) {
    this._unstack_card(card);
    this.unstack_all_from(card);
    this.put_stack_on_pile(card, pile_id);
}

/**
 * Puts a card on top of the pile with the given ID, and then puts any
 * cards that were stacked on top of the given card into the same pile
 * above the target card in the order that they are stacked. The stacked
 * cards remain stacked on the target card, but if that card was stacked
 * on another card, their stack relationship is severed if they wind up
 * in different piles. Recursively handles any cards that might have been
 * stacked on cards which are stacked on the target card.
 *
 * @param card The base of the stack being moved.
 * @param pile_id The pile to move the stack onto.
 */
Game.prototype.put_stack_on_pile = function (card, pile_id) {
    this._remove_stack_from_pile(card);
    card.pile = pile_id;
    this.piles[pile_id].items.push(card);
    this.piles[pile_id].cards_element.appendChild(card.element);
    if (card.stack) {
        for (let stacked of card.stack) {
            this.put_stack_on_pile(stacked, pile_id);
        }
    }
    if (card.stacked_on && card.stacked_on.pile != card.pile) {
        this._unstack_card(card);
    }
}

/**
 * Internal function that handles unstacking a card without moving it.
 * Does nothing if the card isn't stacked. Does not affect any cards
 * stacked on the target.
 *
 * @param card The card being removed from a stack.
 */
Game.prototype._unstack_card = function (card) {
    let stacked_on = card.stacked_on;
    if (!stacked_on) {
        return;
    }
    delete card.stacked_on;
    remove_item_from_array(card, stacked_on.stack);
    if (stacked_on.stack.length == 0) {
        // last in stack, so let's get rid of the stack
        delete stacked_on.stack;
    }
}

/**
 * Removes the target card from the stack it is a part of, placing it
 * after any other cards in that stack within the pile that that stack
 * was part of. Does nothing if the target card is not stacked on another
 * card. If there are cards stacked on top of the target card, those are
 * moved along with it.
 *
 * TODO: Stacking effects on DOM?
 *
 * @param card The card being removed from a stack.
 */
Game.prototype.unstack_card = function (card) {
    let pile = card.pile;
    let stacked_on = card.stacked_on;
    this._unstack_card(card);
    // If there are others still in stack, move ourselves after them
    if (
        pile
     && stacked_on
     && stacked_on.stack
     && stacked_on.stack.length != 0
    ) {
        // re-insert it afterwards
        this.insert_stack_into_pile_after(card, stacked_on);
    }
}

/**
 * Unstacks all cards stacked on the target card, leaving them in their
 * original order. Does nothing if there are no cards stacked on the
 * target card. If the target card is in turn part of a stack on top of
 * another base card, that stack is not affected.
 *
 * DOES NOT recursively unstack any stacks associated with the cards
 * being unstacked from the target base.
 *
 * @param stack_base The card from which stacked cards should be unstacked.
 */
Game.prototype.unstack_all_from = function (stack_base) {
    if (stack_base.stack) {
        for (let in_stack of stack_base.stack.slice()) {
            this._unstack_card(in_stack);
        }
    }
}

/**
 * Shuffles the order of cards in the given pile, and destroys any
 * stacking relationships they were involved in.
 *
 * Fisher-Yates shuffle (Durstenfeld version) from:
 * https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
 *
 * @param pile_id The pile to shuffle.
 */
Game.prototype.shuffle_pile = function (pile_id) {
    let pile_obj = this.piles[pile_id];
    let pile_element = pile_obj.element;
    let pile_cards_element = pile_element.querySelector(".pilecards");
    let pile_items = pile_obj.items;

    // First remove all stacking and remove elements from the DOM:
    for (let card of pile_items) {
        // Destroy stacking relationships
        this.unstack_all_from(card);
        // Remove from the DOM
        card.element.parentNode.removeChild(card.element);
    }

    // Now shuffle the cards
    for (var i = pile_items.length - 1; i > 0; i -= 1) {
        var j = Math.floor(Math.random() * (i + 1));
        var moving = pile_items[i];

        pile_items[i] = pile_items[j];
        pile_items[j] = moving;
    }

    // Re-add each card's element to the DOM according to their new
    // order.
    for (let card of pile_items) {
        pile_cards_element.appendChild(card.element);
    }
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
    let pile_items = this.piles[pile_id].items;
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
 * Returns true if the given card is the top card in its pile. Returns
 * false if the card is not in a pile, or is not the top card in the pile
 * that it's in.
 *
 * @param card The card to check.
 */
Game.prototype.card_is_on_top_of_pile = function (card) {
    if (!card.pile) {
        return false;
    }
    let pile_items = this.piles[card.pile].items;
    return pile_items[pile_items.length - 1] === card;
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

/**
 * Returns an integer indicating how many cards are below the given card
 * among cards stacked on the same card as it, returning 0 when the card
 * in question is the second card in a stack (after the base of the
 * stack). Note that stacked cards can have cards stacked directly on
 * them, as well as cards above them stacked on the same card they're
 * stacked on. This function ignores the former cads entirely. It returns
 * undefined if the given card is not stacked on another card, even if
 * that card does have other cards stacked on it.
 */
Game.prototype.position_in_stack = function (card) {
    if (!card.stacked_on) {
        // Could be the base of its own stack, but not part of another
        // card's stack...
        return undefined;
    }
    return card.stacked_on.stack.indexOf(card);
}

/**
 * Returns true if the card is the top card among cards stacked on the
 * same card as it, and it has no cards stacked on itself. Also returns
 * true if The card is unstacked.
 */
Game.prototype.card_is_on_top_of_stack = function (card) {
    // Neither part of a stack nor the base of a stack
    if (!card.stack && !card.stacked_on) {
        return true;
    } else if (card.stack) {
        // Has cards stacked on it
        return false;
    } else  { // Must be part of a stack, and has no cards stacked on it
        return this.position_in_stack(card) == base.stack.length - 1;
    }
    if (!card.stack) {
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
        pile_obj.cards_element.innerHTML = "";
    }

    // TODO: Cleanup on UI/DOM side of things?!

    // Call the setup function now that everything has been reset
    if (this.rules.setup) {
        this.rules.setup(this);
    }
}


// UI Functions
//-------------

/**
 * Function that starts the process of considering a card for play,
 * whether because of that card being selected or because a drag was
 * initiated. Runs the playability function from the game's rules and
 * returns true if the card is actually playable and consideration is
 * initiated, or false if the card isn't playable and consideration is
 * not allowed.
 *
 * @param card A card object to consider for play.
 */
Game.prototype.start_considering = function (card) {
    let is_playable = this.rules.playable(this, card);
    if (!is_playable) {
        return false;
    } else {
        // if it's a pre-play function call it:
        if (typeof is_playable == "function") {
            this.play_cleanup = is_playable(this, card);
            // it's fine if this result is undefined/null
        }

        // Add the "considering" class to the card element
        card.element.classList.add("considering");
        // Store reference to the card being dragged:
        this.considering = card;
        return true;
    }
}

/**
 * Helper function that ends consideration of a card for play. Also stops
 * any potential target situations, as they are no longer valid if we
 * aren't considering a card for play.
 */
Game.prototype.stop_considering = function () {

    // Stop targeting first, so that this happens even if we weren't
    // considering anything (although that should be impossible).
    this.stop_targeting();

    let considering_card = this.considering;
    if (considering_card == null) {
        return;
    }


    if (this.play_cleanup) {
        this.play_cleanup(this, considering_card);
    }

    considering_card.element.classList.remove("considering");

    this.considering = null;
    this.play_cleanup = null;
}

/**
 * Called when the user indicates a card or pile as a potential target,
 * for example by dragging a card over it. This runs the game's rules'
 * play_target function to determine if the selected card or pile is
 * a valid potential target, given the card currently being considered
 * for play. It returns true if that function returns a card or pile as a
 * valid target, and false otherwise. The card parameter may be omitted
 * or set explicitly to undefined when the user is targeting a pile but
 * no specific card in that pile.
 *
 * @param pile_id The ID of the pile to start targeting.
 * @param card The card object to start targeting, or undefined if the
 *     user is attempting to target a whole pile.
 */
Game.prototype.start_targeting = function (pile_id, card) {
    // First, we stop targeting whatever we're currently targeting
    this.stop_targeting();

    // If we're not currently considering a card for play, we can't
    // target anything...
    if (this.considering == null) {
        console.warn(
            "Attept to start targeting before any consideration "
          + "was established."
        );
        return false;
    }
    let valid_target = this.rules.play_target(
        this,
        this.considering,
        pile_id,
        card
    );
    if (valid_target == null) {
        // The play_target function determined there was no valid target
        return false;
    } else if (
        typeof valid_target == "string"
     || valid_target instanceof String
    ) { // the target is a pile ID, not a card object
        this.potential_target_pile = valid_target;
        this.potential_target_card = undefined;
        return true;
    } else if (typeof valid_target == "object") {
        // the target must be a card object
        this.potential_target_pile = valid_target.pile;
        this.potential_target_card = valid_target;
        return true;
    } else {
        console.error("Invalid target value from play_target:", valid_target);
        return false;
    }
}

/**
 * Returns true if the game is currently considering a card and/or pile
 * as a potential target.
 */
Game.prototype.is_targeting = function () {
    return (
        this.potential_target_pile != null
     || this.potential_target_card != null
    );
}

/**
 * Removes the currently-targeted pile and/or card from consideration as
 * potential targets of play.
 */
Game.prototype.stop_targeting = function () {
    let p_pile = this.potential_target_pile;
    let p_card = this.potential_target_card;
    if (p_pile != null) {
        this.piles[p_pile].element.classList.remove("potential_target");
    }
    if (p_card != null) {
        p_card.element.classList.remove("potential_target");
    }

    this.potential_target_pile = null;
    this.potential_target_card = null;
}

/**
 * Returns the closest ancestor of the given node which has the given
 * CSS class. May return the node itself. Returns null if neither the
 * node nor any of its ancestors has the given class.
 *
 * @param node The DOM node to start at.
 * @param cls The class to look for.
 */
function first_ancestor_with_class(node, cls) {
    if (node.classList != undefined && node.classList.contains(cls)) {
        return node;
    } else if(node.parentNode) {
        return first_ancestor_with_class(node.parentNode, cls);
    } else {
        return null;
    }
}

/**
 * Creates drag handler functions for the given game. Returns an array
 * containing functions for handling the following drag events:
 *
 *   start - fires when the user picks up an element
 *   end - fires when the drag ends without a drop
 *   enter - fires when the drag first enters the area above a target element
 *   leave - fires when the drag leaves the area above a target
 *   during - fires continuously as the element is dragged anywhere
 *   over - fires continuously as the element is dragged over a target
 *   drop - fires when the element is dropped on a target
 *
 * @param game The Game object to create handlers for.
 */
function create_drag_handlers(game) {

    /**
     * Handler for the drag start event, which fires when the user
     * attempts to start dragging an element. Calls the game's
     * start_considering function which will invoke the rules'
     * is_playable function to determine whether or not this is a valid
     * drag target.
     *
     * @param evt The drag start event object.
     */
    function drag_start(evt) {
        let considering_card_div = evt.target;
        if (!considering_card_div.classList.contains("card")) {
            // Can't drag something that isn't a card!
            evt.preventDefault();
            return;
        }
        let considering_card = considering_card_div.card;
        let can_consider = game.start_considering(considering_card);
        if (can_consider) {
            // Set drag data
            // TODO: Set HTML data as well?
            // TODO: Add user-facing names to card types?
            let dtext = considering_card.type;
            if (considering_card.stack) {
                for (let stacked of considering_card.stack) {
                    dtext += ', ' + stacked.type;
                }
            }
            evt.dataTransfer.setData('text/plain', dtext);
        } else {
            // cancel this drag event
            evt.preventDefault();
        }
    }

    /**
     * Fires when a drag event ends without a drop. We simply stop
     * considering the currently-selected card as a card to be played.
     *
     * @param evt The drag end event object.
     */
    function drag_end(evt) {
        game.stop_considering();
    }

    /**
     * Fires when the user drags a card over another element. Only card
     * and pile DOM elements are acknowledged here, but we use
     * first_ancestor_with_class to ensure that dragging over internal
     * elements of a card/pile still targets that card/pile. We use the
     * game's start_targeting function to begin targeting cards and/or
     * piles. That function uses the rules' play_target function to
     * determine what the appropriate target is, and that target will be
     * highlighted.
     *
     * @param evt The drag enter event object.
     */
    function drag_enter(evt) {
        let parent_pile = first_ancestor_with_class(evt.target, "pile");
        let parent_card = first_ancestor_with_class(evt.target, "card");
        let valid = false;
        if (parent_card != null) {
            let card_obj = parent_card.card;
            valid = game.start_targeting(card_obj.pile, card_obj);
        } else if (parent_pile != null) {
            valid = game.start_targeting(
                parent_pile.getAttribute("data-pile-id"),
                undefined
            );
        }
        // Else do nothing; this is not a valid drop target

        // If we did find a valid target, we've got to prevent the
        // default action, which is to reject that element as a valid
        // target element.
        if (valid) {
            evt.preventDefault();
        }
    }

    /**
     * Fires when the user drags a card out from on top of another
     * element. We simply stop targeting if the thing being dragged off
     * of is a pile or card, and let drag_enter handle resuming
     * targeting.
     *
     * @param evt The drag leave event object.
     */
    function drag_leave(evt) {
        if (
            evt.target.classList
         && (
                evt.target.classList.contains("card")
             || evt.target.classList.contains("pile")
            )
        ) {
            game.stop_targeting();
        }
        // Else do nothing; we aren't leaving a valid drop target
    }

    /**
     * Fires continuously while a drag event is happening. For now we
     * don't need to do anything here...
     * TODO: Get rid of this entirely then?
     *
     * @param evt The drag event object.
     */
    function drag_during(evt) {}


    /**
     * Fires continuously while a drag event is happening, with the
     * element being dragged over as the event target. The default action
     * resets the drag action which makes dropping impossible, so we have
     * to prevent that default to enable dropping.
     *
     * @param evt The drag leave event object.
     */
    function drag_over(evt) {
        // Here we have to prevent default if a drop is going to be
        // enabled, and we do so whenever the enter/leave machinery has
        // set up a valid potential target in the game object.
        if (game.is_targeting()) {
            evt.preventDefault();
        }
    }

    /**
     * Fires when a card is dropped. If there is currently a valid
     * potential target, we play the card being considered on that
     * potential target.
     *
     * @param evt The drag drop event object.
     */
    function drag_drop(evt) {
        // We need to prevent the default, which is in some cases to
        // navigate to the drop data as a URL.
        evt.preventDefault();
        // If we don't have a current potential target, we won't do
        // anything
        if (game.is_targeting()) {
            // Play the card on the current target card/pile
            game.rules.play_card(
                game,
                game.considering,
                game.potential_target_pile,
                game.potential_target_card
            );
        }

        // Now that we've played the card (or ignored the drag), we're
        // done considering the current card for play.
        game.stop_considering();
    }

    // Return the handlers we created
    return [
        drag_start,
        drag_end,
        drag_enter,
        drag_leave,
        drag_during,
        drag_over,
        drag_drop
    ];
}

/**
 * This function creates a new DIV with absolute positioning that
 * obscures most of the screen and which contains copies of the HTML for
 * all of the cards in the given pile. The cards are laid out in a grid
 * so that each card is visible, but their face up/down status is
 * unchanged. If another pile is already being inspected, that inspection
 * div is closed. The inspection div includes a button that can be used
 * to close it.
 *
 * @param pile_id The pile to view.
 */
Game.prototype.inspect_pile = function(pile_id) {
    let pile_obj = this.piles[pile_id];
    let elem = pile_obj.element;
    let cardsdiv = elem.querySelector(".pilecards");
    let cards_html = cardsdiv.innerHTML;

    let inspection_div = document.getElementById("inspector");
    let inspected_cards;
    if (inspection_div == null) {
        inspection_div = document.createElement("div");
        inspection_div.setAttribute("id", "inspector");
        inspection_div.classList.add("inspector");
        document.body.appendChild(inspection_div);

        let close = document.createElement("input");
        close.setAttribute("type", "button");
        close.setAttribute("value", "close");
        close.addEventListener("click", function () {
            document.body.removeChild(inspection_div);
        });
        inspection_div.appendChild(close);

        inspected_cards = document.createElement("div");
        inspected_cards.classList.add("inspected_cards");
        inspection_div.appendChild(inspected_cards);
    } else {
        inspected_cards = inspection_div.querySelector(".inspected_cards");
    }

    inspected_cards.innerHTML = cards_html;

    // TODO: Show pile name and card count in the inspector.
}

//---------//
// Actions //
//---------//

/**
 * An Action object represents an action that can be taken other than
 * playing a card on another card/pile. Actions may be associated with
 * piles or individual cards, and they can have conditions that determine
 * when they can be activated.
 *
 * @param icon HTML code to be put into the button that will trigger the
 *     action. Often just a single character.
 * @param perform A function which will be run when the action is
 *     triggered.
 * @param condition (optional) A condition that must be met for the
 *     action to be triggerable. Should be a function which accepts a Game
 *     object and the object to which the action is attached (either a
 *     pile ID or a card object) and which returns true or false. See the
 *     not/any/all functions for how to construct compound conditions.
 */
export function Action(icon, perform, condition) {
    this.icon = icon;
    this.perform = perform;
    this.condition = condition;
}

/**
 * Replaces the icon for an action with a new icon.
 *
 * @param icon The HTML code to be used on the button for triggering this
 *     action.
 *
 * @return The action itself (for chaining).
 */
Action.prototype.with_icon = function(new_icon) {
    this.icon = new_icon;
    return this;
}

/**
 * Pre-defined built-in actions and/or action constructors.
 */
export var actions = {
    /**
     * Creates an action which moves cards into the given destination
     * pile. By default one card is moved, but a second argument may be
     * supplied to specify how many cards to move (if there aren't enough
     * cards, all remaining cards in the pile are still moved). The cards
     * which are moved retain their original order, and are not flipped
     * face up or face down. They are taken from the top of the source
     * pile (the pile that this action is attached to) and placed on top
     * of the destination pile. Any stacking relationships involving
     * moved cards are destroyed by this process, as the cards are moved
     * one-by-one.
     *
     * @param dest_pile_id The pile that cards will be moved to.
     * @param num_cards_or_1 (optional) The number of cards that will be
     *     moved, or "all" to specify that the entire pile should be moved.
     */
    "move_into": function (dest_pile_id, num_cards_or_1) {
        if (num_cards_or_1 == undefined) {
            num_cards_or_1 = 1;
        }
        return new Action(
            "→",
            function (game, pile_id) {
                let cards_in_pile = game.pile_size(pile_id);
                if (num_cards_or_1 == "all") { num_cards_or_1 = cards_in_pile; }
                let to_move = Math.min(cards_in_pile, num_cards_or_1);
                let move_index = cards_in_pile - to_move;
                for (let i = 0; i < to_move; ++i) {
                    let card = game.get_card_in_pile(pile_id, move_index);
                    game.put_card_on_pile(card, dest_pile_id);
                }
            }
        );
    },

    /**
     * Creates an action which flips cards from the base pile onto a
     * specific pile. Cards are taken one-by-one from the top of the
     * source pile and placed on top of the destination pile after
     * flipping them to the opposite of their previous facing. Any
     * stacking relationships they were involved in are destroyed in this
     * process. The order of the cards on top of the destination pile
     * will be the opposite of their order in the source pile, as would
     * naturally happen if you picked up several cards from the top of a
     * physical pile and flipped them over as a stack.
     *
     * By default, one card is flipped, but a second parameter may be
     * supplied to specify the number to flip. If there are not enough
     * cards in the pile, the entire pile is flipped.
     *
     * @param dest_pile_id The pile into which to flip cards.
     * @param num_cards_or_1 (optional) The number of cards to flip, or
     *     "all" to specify that the entire pile should be flipped.
     */
    "flip_into": function (dest_pile_id, num_cards_or_1) {
        if (num_cards_or_1 == undefined) { num_cards_or_1 = 1; }
        return new Action(
            "↷",
            function (game, pile_id) {
                let cards_in_pile = game.pile_size(pile_id);
                if (num_cards_or_1 == "all") { num_cards_or_1 = cards_in_pile; }
                let to_move = Math.min(cards_in_pile, num_cards_or_1);
                for (let i = 0; i < to_move; ++i) {
                    let card = game.top_card_of_pile(pile_id);
                    game.put_card_on_pile(card, dest_pile_id);
                    game.flip_card(card);
                }
            }
        );
    },

    /**
     * Creates an action which takes cards from the source pile (the pile
     * to which the action is attached), puts them on top of another
     * pile, and then shuffles that pile. By default all cards in the
     * source pile are moved, but a second argument may be used to
     * specify a number of cards to move. If there aren't enough
     * cards, all remaining cards will still be move. Note that the
     * entire destination pile is shuffled every time this action is
     * triggered, regardless of whether any cards were moved.
     *
     * Any stacking structures among moved cards are destroyed by the
     * process, as are stacking structures in the destination pile, since
     * shuffling destroys them.
     *
     * @param dest_pile_id The pile into which to shuffle cards.
     * @param num_cards_or_all (optional) The number of cards to shuffle
     *     each time, or "all" to shuffle all cards (the default).
     */
    "shuffle_into": function (dest_pile_id, num_cards_or_all) {
        if (num_cards_or_all == undefined) { num_cards_or_all == "all"; }
        return new Action(
            "⭮",
            function (game, pile_id) {
                let cards_in_pile = game.pile_size(pile_id);
                let num_to_move = num_cards_or_all;
                if (num_to_move == "all") { num_to_move = cards_in_pile; }
                num_to_move = Math.min(cards_in_pile, num_to_move);
                for (let i = 0; i < num_to_move; ++i) {
                    let card = game.top_card_of_pile(pile_id);
                    game.put_card_on_pile(card, dest_pile_id);
                }
                game.shuffle_pile(dest_pile_id);
            }
        );
    },
}

//-------------------//
// Action Conditions //
//-------------------//

/**
 * Updates the condition of an action. If this is called more than once
 * on the same action, later calls replace the conditions specified by
 * earlier calls. Instead, use the any/all functions to create compound
 * conditions. This function returns the action it modified.
 *
 * @param condition The condition to set.
 *
 * @return The action itself (for chaining).
 */
Action.prototype.with_condition = function(new_condition) {
    this.condition = new_condition;
    return this;
}

/**
 * Creates an inverse condition that's met when the given condition is
 * not met.
 *
 * @param condition The condition to invert.
 */
export function not(condition) {
    return function check(game, base_pile_id) {
        return !condition(game, base_pile_id);
    }
}

/**
 * Creates a compound condition that's met when any of the given
 * conditions are met.
 *
 * @param conditions Any number of conditions to combine.
 */
export function any(...conditions) {
    return function check(game, base_pile_id) {
        for (let cond of conditions) {
            if (cond(game, base_pile_id)) {
                return true;
            }
        }
        return false;
    }
}

/**
 * Creates a compound condition that's only met when all of the given
 * conditions are met simultaneously.
 *
 * @param conditions Any number of conditions to combine.
 */
export function all(...conditions) {
    return function check(game, base_pile_id) {
        for (let cond of conditions) {
            if (!cond(game, base_pile_id)) {
                return false;
            }
        }
        return true;
    }
}

// Note that multiple conditions may be applied to the same action, in
// which case all of them must be simultaneously true.
export var conditions = {
    /**
     * Creates a condition which is met only when the pile with the given
     * ID is empty. Note that the pile being checked is the one with the
     * specified ID and NOT the pile to which the action using this
     * condition is attached.
     *
     * @param pile_id The pile to check.
     */
    "when_empty": function(pile_id) {
        return function check(game, base_pile_id) {
            return game.pile_size(pile_id) == 0;
        }
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
    "individual_stacks": function(pile_div) {
        pile_div.classList.add("individual_stacks");
    },
}

//------------//
// Unit tests //
//------------//

export function test() {
    unit.run_all_tests();
}

// remove_item_from_array
unit.register(function test_remove_item_from_array_first() {
    let a = [1, 2, 3];
    remove_item_from_array(1, a);
    return unit.same_obj(a, [2, 3]);
});
unit.register(function test_remove_item_from_array_middle() {
    let a = [1, 2, 3];
    remove_item_from_array(2, a);
    return unit.same_obj(a, [1, 3]);
});
unit.register(function test_remove_item_from_array_last() {
    let a = [1, 2, 3];
    remove_item_from_array(3, a);
    return unit.same_obj(a, [1, 2]);
});
unit.register(function test_remove_item_from_array_string() {
    let a = ["a", "b", "aa"];
    remove_item_from_array("aa", a);
    return unit.same_obj(a, ["a", "b"]);
});
unit.register(function test_remove_item_from_array_substring() {
    let a = ["a", "b", "aa"];
    remove_item_from_array("a", a);
    return unit.same_obj(a, ["b", "aa"]);
});
unit.register(function test_remove_item_from_array_obj() {
    let o = {1: 2, 3: 4};
    let a = [o, {5: 6, 7: 8}, {9: 10, 11: 12}];
    remove_item_from_array(o, a);
    return unit.same_obj(a, [{5: 6, 7: 8}, {9: 10, 11: 12}]);
});
unit.register(function test_remove_item_from_array_obj_same() {
    let o = {1: 2, 3: 4};
    let a = [o, {5: 6, 7: 8}, {9: 10, 11: 12}];
    remove_item_from_array({1: 2, 3: 4}, a);
    // clone doesn't result in removal of item
    return unit.same_obj(a, [{1: 2, 3: 4}, {5: 6, 7: 8}, {9: 10, 11: 12}]);
});

// copy_nonrecursive_obj
unit.register(function test_copy_nonrecursive_obj() {
    let o = {"key": {"type": "value", "level": 2}, "key2": [1, 2, {3: 5}] };
    let copy = copy_nonrecursive_obj(o);
    return unit.same_obj(o, copy);
});

// next_card_id
unit.register(function test_next_card_id() {
    let id1 = next_card_id();
    let id2 = next_card_id();
    return id1 != id2;
});

// Library.register_card
unit.register(function test_Library_register_card() {
    let tl = new Library();
    let face = "<p>test</p><p>card</p>";
    let properties = { "test": "value", "another": "property" };
    tl.register_card("test card", face, properties);
    return (
        tl.all_cards[0] == "test card"
     && tl.card_data.hasOwnProperty("test card")
     && tl.card_data["test card"].face == face
     && tl.card_data["test card"].properties === properties
    );
});

/**
 * Testing helper function that sets up a simple Library object.
 */
function setup_test_library() {
    let tl = new Library();
    tl.register_card("t1", "t1", { "number": 1, "color": "blue" });
    tl.register_card("t2", "t2", { "number": 2, "color": "blue" });
    tl.register_card("t3", "t3", { "number": 3, "color": "red" });
    tl.register_card("t4", "t4", { "number": 4, "color": "red" });
    tl.register_card("t5", "t5", { "number": 5, "color": "yellow" });
    tl.create_group("evens", props => props.number % 2 == 0);
    tl.create_group("odds", props => props.number % 2 == 1);
    tl.create_group("blues", props => props.color == "blue");
    tl.create_group("reds", props => props.color == "red");
    tl.create_group("yellows", props => props.color == "yellow");
    tl.create_group("all", props => true);

    return tl;
}

//  Library groups
unit.register(function test_Library_groups() {
    let tl = setup_test_library();

    if (!tl.card_type_belongs_to_group("t1", "odds")) { return 1; }
    if (tl.card_type_belongs_to_group("t1", "evens")) { return 2; }
    if (!tl.card_type_belongs_to_group("t1", "blues")) { return 3; }
    if (tl.card_type_belongs_to_group("t1", "reds")) { return 4; }
    if (tl.card_type_belongs_to_group("t1", "yellows")) { return 5; }
    if (!tl.card_type_belongs_to_group("t1", "all")) { return 6; }

    if (tl.card_type_belongs_to_group("t4", "odds")) { return 7; }
    if (!tl.card_type_belongs_to_group("t4", "evens")) { return 8; }
    if (tl.card_type_belongs_to_group("t4", "blues")) { return 9; }
    if (!tl.card_type_belongs_to_group("t4", "reds")) { return 10; }
    if (tl.card_type_belongs_to_group("t4", "yellows")) { return 11; }
    if (!tl.card_type_belongs_to_group("t4", "all")) { return 12; }

    if (!unit.same_obj(tl.all_card_types_in_group("odds"), ["t1", "t3", "t5"])){
        return 13;
    }

    if (!unit.same_obj(tl.all_card_types_in_group("evens"), ["t2", "t4"])) {
        return 14;
    }

    if (!unit.same_obj(tl.all_card_types_in_group("blues"), ["t1", "t2"])) {
        return 15;
    }

    if (!unit.same_obj(tl.all_card_types_in_group("reds"), ["t3", "t4"])) {
        return 16;
    }

    if (!unit.same_obj(tl.all_card_types_in_group("yellows"), ["t5"])) {
        return 17;
    }

    if (
        !unit.same_obj(
            tl.all_card_types_in_group("all"),
            ["t1", "t2", "t3", "t4", "t5"]
        )
    ) {
        return 18;
    }

    return true;
});

/**
 * Testing helper function that sets up a simple test Game object.
 *
 * @param play_area The play_area div to use for the game; if omitted a
 * fresh DIV not attached to the DOM will be used.
 */
function setup_test_game(play_area) {
    // Create a simple card library for testing purposes
    let tl = setup_test_library();

    // We us an unattached DIV for the play area.
    if (play_area == undefined) {
        play_area = document.createElement("div");
    }

    // Simple rules for our test game
    let rules = {
        "piles": [
            "deck1", "deck2",
            "drawn",
            "play",
            "slot1", "slot2", "slot3"
        ],
        "pile_groups": {
            "slot": [ "slot1", "slot2", "slot3" ],
            "deck": [ "deck1", "deck2" ]
        },
        "pile_settings": {
            ".deck": {
                "display": styles.deck,
                "actions": [ actions.flip_into("drawn", 1) ]
            },
            "drawn": { "display": styles.show_top(3) },
            "play": { "display": styles.individual_stacks }
        },
        "phases": [ "turn" ], // TODO: implement & test phases!
        "phase_groups": {}, // TODO: Test phase groups!
        "phase_settings": {
            "turn": {
                "action_limit": undefined,
                "play_limit": 1
            }
        },
        "card_settings": {}, // TODO: Implement + test this?
        "setup": function (game) {
            // Create 20 cards (5 copies of each number 1-4) putting
            // odd cards into deck1 and even cards into deck2
            for (let i = 0; i < 5; ++i) {
                let t1 = game.create_card("t1");
                game.put_card_on_pile(t1, "deck1");
                let t2 = game.create_card("t2");
                game.put_card_on_pile(t1, "deck2");
                let t3 = game.create_card("t3");
                game.put_card_on_pile(t1, "deck1");
                let t4 = game.create_card("t4");
                game.put_card_on_pile(t1, "deck2");
            }
            // Create 4 extra fives and put two into each deck
            for (let i = 0; i < 4; ++i) {
                let t5 = game.create_card("t5");
                if (i % 2 == 0) {
                    game.put_card_on_pile(t5, "deck1");
                } else {
                    game.put_card_on_pile(t5, "deck2");
                }
            }

            // Shuffle both decks
            game.shuffle_pile("deck1");
            game.shuffle_pile("deck2");
        },
        "playable": function (game, card) {
            // If this card is face-down or is not in a pile, it
            // cannot be played.
            if (!card.pile || !card.face_up) {
                return false;
            }

            // Playable cards must be at the top of the 'drawn' pile, 
            // at the top of a stack in the playable area, or be in
            // one of the slots.
            let pile = card.pile;
            if (game.pile_is_in_group(pile, "slot")) {
                return true; // playable without any prep
            } else if (pile == "drawn") {
                return game.card_is_on_top_of_pile(card);
            } else if (pile == "play") {
                return game.card_is_on_top_of_stack(card);
            } else {
                // Cards in the deck piles may not be played
                return false;
            }
        },
        "play_target": function (game, card, target_pile, target_card) {
            if (game.pile_is_in_group(target_pile, "slot")) {
                // Can play any card on an empty slot, but nothing on
                // a full slot.
                if (game.pile_size(target_pile) == 0) {
                    return target_pile;
                } else {
                    return undefined;
                }
            } else if (target_pile == "play") {
                // Can play (stack) any card on any other in the play
                // area, and the target will always be set to the
                // bottom of the stack that the hovered card is in.
                if (target_card.stacked_on) {
                    return target_card.stacked_on;
                } else {
                    return target_card;
                }
            } else {
                return undefined; // not a valid target
            }
        },
        "play_card": function (game, card, target_pile, target_card) {
            // if there's a target card, we stack onto it, otherwise
            // we put the card being played into the target pile
            if (target_card != undefined) {
                game.stack_card_on_card(card, target_card);
            } else {
                game.put_card_on_pile(card, target_pile);
            }
        }
    }

    return new Game(tl, rules, play_area);
}

// Game setup
unit.register(function test_Game_setup() {
    let tg = setup_test_game();
    return true;
});

// Playable game test
unit.register(function test_Game_playable() {
    let tg = setup_test_game(document.getElementById("play_area"));
    tg.new_game();
    return true;
});

// Game pile creation/use/deletion
unit.register(function test_Game_pile_operations() {
    let tg = setup_test_game();
    tg.create_pile("tp");
    if (tg.pile_size("tp") != 0) { return 1; }
    let c1 = tg.create_card("t1");
    let c2 = tg.create_card("t2");
    tg.put_card_on_pile(c1, "tp");
    if (tg.all_cards_in_pile("tp").length !== 1) { return 2; }
    if (tg.all_cards_in_pile("tp")[0] !== c1) { return 3; }
    if (tg.get_card_in_pile("tp", 0) !== c1) { return 4; }
    if (tg.top_card_of_pile("tp", 0) !== c1) { return 5; }
    if (tg.bottom_card_of_pile("tp", 0) !== c1) { return 6; }
    if (!tg.card_is_on_top_of_pile(c1)) { return 7; }
    if (c1.pile != "tp") { return 8; }
    if (tg.pile_size("tp") != 1) { return 9; }

    tg.put_card_on_pile(c2, "tp");
    if (tg.all_cards_in_pile("tp").length != 2) { return 10; }
    if (tg.all_cards_in_pile("tp")[0] !== c1) { return 11; }
    if (tg.all_cards_in_pile("tp")[1] !== c2) { return 12; }
    if (tg.get_card_in_pile("tp", 0) !== c1) { return 13; }
    if (tg.get_card_in_pile("tp", 1) !== c2) { return 14; }
    if (tg.top_card_of_pile("tp") !== c2) { return 15; }
    if (tg.bottom_card_of_pile("tp") !== c1) { return 16; }
    if (!tg.card_is_on_top_of_pile(c2)) { return 17; }
    if (tg.card_is_on_top_of_pile(c1)) { return 18; }
    if (c1.pile != "tp") { return 19; }
    if (c2.pile != "tp") { return 20; }
    if (tg.pile_size("tp") != 2) { return 21; }

    tg.remove_card_from_pile(c1);
    if (tg.all_cards_in_pile("tp").length != 1) { return 22; }
    if (tg.all_cards_in_pile("tp")[0] != c2) { return 23; }
    if (tg.get_card_in_pile("tp", 0) !== c2) { return 24; }
    if (tg.get_card_in_pile("tp", 1) != undefined) { return 25; }
    if (tg.top_card_of_pile("tp") !== c2) { return 26; }
    if (tg.bottom_card_of_pile("tp") !== c2) { return 27; }
    if (!tg.card_is_on_top_of_pile(c2)) { return 28; }
    if (tg.card_is_on_top_of_pile(c1)) { return 29; }
    if (c1.pile != undefined) { return 30; }
    if (c2.pile != "tp") { return 31; }
    if (tg.pile_size("tp") != 1) { return 32; }

    tg.remove_card_from_pile(c2);
    if (tg.all_cards_in_pile("tp").length != 0) { return 33; }
    if (tg.get_card_in_pile("tp", 0) != undefined) { return 34; }
    if (tg.top_card_of_pile("tp") != undefined) { return 35; }
    if (tg.bottom_card_of_pile("tp") != undefined) { return 36; }
    if (tg.card_is_on_top_of_pile(c1)) { return 37; }
    if (tg.card_is_on_top_of_pile(c2)) { return 38; }
    if (c1.pile != undefined) { return 39; }
    if (c2.pile != undefined) { return 40; }
    if (tg.pile_size("tp") != 0) { return 41; }

    tg.put_card_on_pile(c1, "tp");
    if (tg.pile_size("tp") != 1) { return 42; }
    if (c1.pile != "tp") { return 43; }
    if (tg.top_card_of_pile("tp") !== c1) { return 44; }

    tg.delete_pile("tp");
    if (c1.pile != undefined) { return 45; }

    return true;
});

// Game pile groups
unit.register(function test_Game_pile_groups() {
    let tg = setup_test_game();
    tg.create_pile("tp1");
    tg.create_pile("tp2");
    if (tg.pile_size("tp1") != 0) { return 1; }
    if (tg.pile_size("tp2") != 0) { return 2; }

    tg.add_pile_to_group("tp1", "g1");
    tg.add_pile_to_group("tp1", "g2");
    tg.add_pile_to_group("tp1", "g3");
    tg.add_pile_to_group("tp2", "g1");

    if (!tg.pile_is_in_group("tp1", "g1")) { return 3; }
    if (!tg.pile_is_in_group("tp1", "g2")) { return 4; }
    if (!tg.pile_is_in_group("tp1", "g3")) { return 5; }
    if (tg.pile_is_in_group("tp1", "nope")) { return 6; }
    if (!tg.pile_is_in_group("tp2", "g1")) { return 7; }
    if (tg.pile_is_in_group("tp2", "g2")) { return 8; }
    if (tg.pile_is_in_group("tp2", "g3")) { return 9; }
    if (!unit.same_obj(tg.all_piles_in_group("g1"), ["tp1", "tp2"])) {
        return 10;
    }
    if (!unit.same_obj(tg.all_piles_in_group("g2"), ["tp1"])) { return 11; }
    if (!unit.same_obj(tg.all_piles_in_group("g3"), ["tp1"])) { return 12; }
    if (!unit.same_obj(tg.all_piles_in_group("nope"), [])) { return 13; }

    tg.remove_pile_from_group("tp1", "g3");
    if (tg.pile_is_in_group("tp1", "g3")) { return 14; }
    if (!unit.same_obj(tg.all_piles_in_group("g3"), [])) { return 15; }

    tg.remove_pile_from_group("tp1", "g2");
    if (tg.pile_is_in_group("tp1", "g2")) { return 16; }
    if (!unit.same_obj(tg.all_piles_in_group("g2"), [])) { return 17; }

    tg.remove_pile_from_group("tp1", "g1");
    if (tg.pile_is_in_group("tp1", "g1")) { return 18; }
    if (!tg.pile_is_in_group("tp2", "g1")) { return 19; }
    if (!unit.same_obj(tg.all_piles_in_group("g1"), ["tp2"])) { return 20; }

    tg.remove_pile_from_group("tp2", "g1");
    if (tg.pile_is_in_group("tp1", "g1")) { return 21; }
    if (tg.pile_is_in_group("tp2", "g1")) { return 22; }
    if (!unit.same_obj(tg.all_piles_in_group("g1"), [])) { return 23; }

    return true;
});

// Game stacking stuff
unit.register(function test_Game_stacking() {
    let tg = setup_test_game();
    tg.create_pile("tp");
    tg.create_pile("tp2");
    if (tg.pile_size("tp") != 0 || tg.pile_size("tp2") != 0) { return 1; }
    let c1 = tg.create_card("t1");
    let c2 = tg.create_card("t2");
    let c3 = tg.create_card("t3");
    let c4 = tg.create_card("t4");
    tg.put_card_on_pile(c1, "tp");
    tg.put_card_on_pile(c2, "tp");

    tg._remove_card_from_pile(c1);
    if (tg.pile_size("tp") != 1) { return 2; }
    if (tg.top_card_of_pile("tp") !== c2) { return 3; }
    if (c1.pile != undefined) { return 4; }
    if (c2.pile != "tp") { return 5; }

    tg._remove_card_from_pile(c2);
    if (tg.pile_size("tp") != 0) { return 6; }
    if (tg.top_card_of_pile("tp") != undefined) { return 7; }
    if (c1.pile != undefined) { return 8; }
    if (c2.pile != undefined) { return 9; }

    // Basic stack
    tg._stack_cards(c2, c1);
    if (c2.stacked_on != c1) { return 10; }
    if (c1.stack.length != 1) { return 11; }
    if (c1.stack[0] !== c2) { return 12; }

    // Basic unstack
    tg._unstack_card(c2);
    if (c2.stacked_on != undefined) { return 13; }
    if (c1.stack != undefined) { return 14; }

    // Advanced stack
    tg.stack_card_on_card(c2, c1);
    if (c2.pile != c1.pile) { return 15; }
    if (c2.stacked_on != c1) { return 16; }
    if (c1.stack.length != 1) { return 17; }
    if (c1.stack[0] !== c2) { return 18; }

    // Advanced unstack
    tg.unstack_card(c2);
    if (c2.stacked_on != undefined) { return 19; }
    if (c1.stack != undefined) { return 20; }

    // Stacking and unstacking while in a pile
    tg.put_card_on_pile(c1, "tp");
    tg.put_card_on_pile(c2, "tp");
    if (tg.pile_size("tp") != 2) { return 21; }
    if (tg.top_card_of_pile("tp") !== c2) { return 22; }
    if (tg.bottom_card_of_pile("tp") !== c1) { return 23; }

    // No-movement stacking where c3 is unpiled
    tg._stack_cards(c2, c1)
    tg._stack_cards(c3, c1)
    if (c1.pile != "tp") { return 24; }
    if (c2.pile != "tp") { return 25; }
    if (c3.pile != undefined) { return 26; }
    if (c2.stacked_on !== c1) { return 27; }
    if (c3.stacked_on !== c1) { return 28; }
    if (c1.stack.length != 2) { return 29; }
    if (c1.stack[0] !== c2) { return 30; }
    if (c1.stack[1] !== c3) { return 31; }

    // No-movement unstacking
    tg._unstack_card(c2);
    if (c1.stack.length != 1) { return 32; }
    if (c1.stack[0] !== c3) { return 33; }
    if (c2.stacked_on != undefined) { return 34; }
    if (c3.stacked_on !== c1) { return 35; }
    if (c1.pile != "tp") { return 36; }
    if (c2.pile != "tp") { return 37; }
    if (c3.pile != undefined) { return 38; }
    if (tg.get_card_in_pile("tp", 0) !== c1) { return 39; }
    if (tg.get_card_in_pile("tp", 1) !== c2) { return 40; }
    if (tg.pile_size("tp") != 2) { return 41; }

    tg._unstack_card(c3);
    if (c1.stack != undefined) { return 42; }
    if (c2.stacked_on != undefined) { return 43; }
    if (c3.stacked_on != undefined) { return 44; }
    if (c1.pile != "tp") { return 45; }
    if (c2.pile != "tp") { return 46; }
    if (c3.pile != undefined) { return 47; }
    if (tg.get_card_in_pile("tp", 0) !== c1) { return 48; }
    if (tg.get_card_in_pile("tp", 1) !== c2) { return 49; }
    if (tg.pile_size("tp") != 2) { return 50; }

    // Stacking w/ movement
    tg.stack_card_on_card(c2, c1);
    if (c2.stacked_on !== c1) { return 51; }
    if (c1.stack.length != 1) { return 52; }
    if (c1.stack[0] !== c2) { return 53; }
    if (c1.pile != "tp") { return 54; }
    if (c2.pile != "tp") { return 55; }
    if (c3.pile != undefined) { return 56; }
    if (tg.pile_size("tp") != 2) { return 57; }
    if (tg.get_card_in_pile("tp", 0) !== c1) { return 58; }
    if (tg.get_card_in_pile("tp", 1) !== c2) { return 59; }

    tg.stack_card_on_card(c3, c1);
    if (c2.stacked_on !== c1) { return 60; }
    if (c3.stacked_on !== c1) { return 61; }
    if (tg.stack_root(c2) !== c1) { return 62; }
    if (tg.stack_root(c3) !== c1) { return 63; }
    if (c1.stack.length != 2) { return 64; }
    if (c1.stack[0] !== c2) { return 65; }
    if (c1.stack[1] !== c3) { return 66; }
    if (c1.pile != "tp") { return 67; }
    if (c2.pile != "tp") { return 68; }
    if (c3.pile != "tp") { return 69; } // should be moved into the pile
    if (tg.pile_size("tp") != 3) { return 70; }
    if (tg.get_card_in_pile("tp", 0) !== c1) { return 71; }
    if (tg.get_card_in_pile("tp", 1) !== c2) { return 72; }
    if (tg.get_card_in_pile("tp", 2) !== c3) { return 73; }

    tg.unstack_card(c2);
    if (c2.stacked_on != undefined) { return 74; }
    if (c3.stacked_on !== c1) { return 75; }
    if (c1.stack.length != 1) { return 76; }
    if (c1.stack[0] !== c3) { return 77; }
    if (c1.pile != "tp") { return 78; }
    if (c2.pile != "tp") { return 79; }
    if (c3.pile != "tp") { return 80; }
    if (tg.pile_size("tp") != 3) { return 81; }
    if (tg.get_card_in_pile("tp", 0) !== c1) { return 82; }
    if (tg.get_card_in_pile("tp", 1) !== c3) { return 83; } // order swapped
    if (tg.get_card_in_pile("tp", 2) !== c2) { return 84; }

    // Reset things
    tg.remove_card_from_pile(c3);
    tg.remove_card_from_pile(c2);
    tg.remove_card_from_pile(c1);

    if (c1.stacked_on != undefined || c1.stack != undefined) { return 85; }
    if (c2.stacked_on != undefined || c2.stack != undefined) { return 86; }
    if (c3.stacked_on != undefined || c3.stack != undefined) { return 87; }
    if (tg.pile_size("tp") != 0) { return 88; }
    if (c1.pile != undefined) { return 89; }
    if (c2.pile != undefined) { return 90; }
    if (c3.pile != undefined) { return 91; }

    // Pile-to-pile movement
    tg.put_card_on_pile(c1, "tp");
    tg.put_card_on_pile(c2, "tp2");
    tg.stack_card_on_card(c3, c2);
    tg.stack_card_on_card(c4, c2);
    if (c1.stacked_on != undefined || c2.stacked_on != undefined) { return 92; }
    if (c3.stacked_on !== c2) { return 93; }
    if (c4.stacked_on !== c2) { return 94; }
    if (c1.pile != "tp") { return 95; }
    if (c2.pile != "tp2") { return 96; }
    if (c3.pile != "tp2") { return 97; }
    if (c4.pile != "tp2") { return 98; }
    if (tg.pile_size("tp") != 1) { return 99; }
    if (tg.pile_size("tp2") != 3) { return 100; }
    if (tg.get_card_in_pile("tp", 0) !== c1) { return 101; }
    if (tg.get_card_in_pile("tp2", 0) !== c2) { return 102; }
    if (tg.get_card_in_pile("tp2", 1) !== c3) { return 103; }
    if (tg.get_card_in_pile("tp2", 2) !== c4) { return 104; }

    // should move the stacked cards along with
    tg.stack_card_on_card(c2, c1);
    if (c1.stacked_on != undefined) { return 105; }
    if (c2.stacked_on !== c1) { return 106; }
    if (c3.stacked_on !== c2) { return 107; }
    if (c4.stacked_on !== c2) { return 108; }
    if (c1.pile != "tp") { return 109; }
    if (c2.pile != "tp") { return 110; }
    if (c3.pile != "tp") { return 111; }
    if (c4.pile != "tp") { return 112; }
    if (tg.pile_size("tp") != 4) { return 113; }
    if (tg.pile_size("tp2") != 0) { return 114; }
    if (tg.get_card_in_pile("tp", 0) !== c1) { return 115; }
    if (tg.get_card_in_pile("tp", 1) !== c2) { return 116; }
    if (tg.get_card_in_pile("tp", 2) !== c3) { return 117; }
    if (tg.get_card_in_pile("tp", 3) !== c4) { return 118; }

    // Back to the other pile
    tg.put_stack_on_pile(c2, "tp2");
    if (c1.stacked_on != undefined) { return 119; }
    if (c2.stacked_on != undefined) { return 120; }
    if (c3.stacked_on !== c2) { return 121; }
    if (c4.stacked_on !== c2) { return 122; }
    if (c1.pile != "tp") { return 123; }
    if (c2.pile != "tp2") { return 124; }
    if (c3.pile != "tp2") { return 125; }
    if (c4.pile != "tp2") { return 126; }
    if (tg.pile_size("tp") != 1) { return 127; }
    if (tg.pile_size("tp2") != 3) { return 128; }
    if (tg.get_card_in_pile("tp", 0) !== c1) { return 129; }
    if (tg.get_card_in_pile("tp2", 0) !== c2) { return 130; }
    if (tg.get_card_in_pile("tp2", 1) !== c3) { return 131; }
    if (tg.get_card_in_pile("tp2", 2) !== c4) { return 132; }

    // Back to the first pile
    tg.put_stack_on_pile(c2, "tp");
    if (c1.stacked_on != undefined) { return 133; }
    if (c2.stacked_on != undefined) { return 134; }
    if (c3.stacked_on !== c2) { return 135; }
    if (c4.stacked_on !== c2) { return 136; }
    if (c1.pile != "tp") { return 137; }
    if (c2.pile != "tp") { return 138; }
    if (c3.pile != "tp") { return 139; }
    if (c4.pile != "tp") { return 140; }
    if (tg.pile_size("tp") != 4) { return 141; }
    if (tg.pile_size("tp2") != 0) { return 142; }
    if (tg.get_card_in_pile("tp", 0) !== c1) { return 143; }
    if (tg.get_card_in_pile("tp", 1) !== c2) { return 144; }
    if (tg.get_card_in_pile("tp", 2) !== c3) { return 145; }
    if (tg.get_card_in_pile("tp", 3) !== c4) { return 146; }

    // Back and forth using insert after this time
    tg.put_stack_on_pile(c2, "tp");
    tg.insert_stack_into_pile_after(c2, c1);
    if (c1.stacked_on != undefined) { return 147; }
    if (c2.stacked_on != undefined) { return 148; }
    if (c3.stacked_on !== c2) { return 149; }
    if (c4.stacked_on !== c2) { return 150; }
    if (c1.pile != "tp") { return 151; }
    if (c2.pile != "tp") { return 152; }
    if (c3.pile != "tp") { return 153; }
    if (c4.pile != "tp") { return 154; }
    if (tg.pile_size("tp") != 4) { return 155; }
    if (tg.pile_size("tp2") != 0) { return 156; }
    if (tg.get_card_in_pile("tp", 0) !== c1) { return 157; }
    if (tg.get_card_in_pile("tp", 1) !== c2) { return 158; }
    if (tg.get_card_in_pile("tp", 2) !== c3) { return 159; }
    if (tg.get_card_in_pile("tp", 3) !== c4) { return 160; }
    if (c2.stack.length != 2) { return 161; }
    if (c2.stack[0] !== c3) { return 162; }
    if (c2.stack[1] !== c4) { return 163; }

    // Reverse situation into other pile
    tg.put_stack_on_pile(c2, "tp2");
    tg.stack_card_on_card(c1, c2);
    if (c1.stacked_on !== c2) { return 164; }
    if (c2.stacked_on != undefined) { return 165; }
    if (c3.stacked_on !== c2) { return 166; }
    if (c4.stacked_on !== c2) { return 167; }
    if (c1.pile != "tp2") { return 168; }
    if (c2.pile != "tp2") { return 169; }
    if (c3.pile != "tp2") { return 170; }
    if (c4.pile != "tp2") { return 171; }
    if (tg.pile_size("tp") != 0) { return 172; }
    if (tg.pile_size("tp2") != 4) { return 173; }
    if (tg.get_card_in_pile("tp2", 0) !== c2) { return 174; }
    if (tg.get_card_in_pile("tp2", 1) !== c3) { return 175; }
    if (tg.get_card_in_pile("tp2", 2) !== c4) { return 176; }
    if (tg.get_card_in_pile("tp2", 3) !== c1) { return 177; }
    if (c2.stack.length != 3) { return 178; }
    if (c2.stack[0] !== c3) { return 179; }
    if (c2.stack[1] !== c4) { return 180; }
    if (c2.stack[2] !== c1) { return 181; }

    // Unstack all
    tg.unstack_all_from(c2);
    if (c2.stack != undefined) { return 182; }
    if (c3.stacked_on != undefined) { return 183; }
    if (c4.stacked_on != undefined) { return 184; }
    if (c1.stacked_on != undefined) { return 185; }
    if (tg.pile_size("tp") != 0) { return 186; }
    if (tg.pile_size("tp2") != 4) { return 187; }
    if (tg.get_card_in_pile("tp2", 0) !== c2) { return 188; }
    if (tg.get_card_in_pile("tp2", 1) !== c3) { return 189; }
    if (tg.get_card_in_pile("tp2", 2) !== c4) { return 190; }
    if (tg.get_card_in_pile("tp2", 3) !== c1) { return 191; }
    let tp2ce = tg.piles["tp2"].cards_element;
    if (tp2ce.childNodes.length != 4) { return 192; }
    console.log(tp2ce.childNodes);
    if (tp2ce.childNodes[0] !== c2.element) { return 193; }
    if (tp2ce.childNodes[1] !== c3.element) { return 194; }
    if (tp2ce.childNodes[2] !== c4.element) { return 195; }
    if (tp2ce.childNodes[3] !== c1.element) { return 196; }

    // Iterated (re) stacking
    let target_index = tg.position_in_pile(c2);
    for (
        let idx = target_index + 1;
        idx < tg.pile_size(c2.pile);
        idx += 1
    ) {
        let above = tg.get_card_in_pile(c2.pile, idx);
        tg.stack_card_on_card(above, c2);
    }
    if (c1.stacked_on !== c2) { return 197; }
    if (c2.stacked_on != undefined) { return 198; }
    if (c3.stacked_on !== c2) { return 199; }
    if (c4.stacked_on !== c2) { return 200; }
    if (c1.pile != "tp2") { return 201; }
    if (c2.pile != "tp2") { return 202; }
    if (c3.pile != "tp2") { return 203; }
    if (c4.pile != "tp2") { return 204; }
    if (tg.pile_size("tp") != 0) { return 205; }
    if (tg.pile_size("tp2") != 4) { return 206; }
    if (tg.get_card_in_pile("tp2", 0) !== c2) { return 207; }
    if (tg.get_card_in_pile("tp2", 1) !== c3) { return 208; }
    if (tg.get_card_in_pile("tp2", 2) !== c4) { return 209; }
    if (tg.get_card_in_pile("tp2", 3) !== c1) { return 210; }
    if (c2.stack.length != 3) { return 211; }
    if (c2.stack[0] !== c3) { return 212; }
    if (c2.stack[1] !== c4) { return 213; }
    if (c2.stack[2] !== c1) { return 214; }
    if (tp2ce.childNodes.length != 4) { return 215; }
    if (tp2ce.childNodes[0] !== c2.element) { return 216; }
    if (tp2ce.childNodes[1] !== c3.element) { return 217; }
    if (tp2ce.childNodes[2] !== c4.element) { return 218; }
    if (tp2ce.childNodes[3] !== c1.element) { return 219; }

    // Unstack once more
    tg.unstack_all_from(c2);
    if (c1.stacked_on !== undefined) { return 220; }
    if (c2.stacked_on != undefined) { return 221; }
    if (c3.stacked_on !== undefined) { return 222; }
    if (c4.stacked_on !== undefined) { return 223; }
    if (c1.pile != "tp2") { return 224; }
    if (c2.pile != "tp2") { return 225; }
    if (c3.pile != "tp2") { return 226; }
    if (c4.pile != "tp2") { return 227; }
    if (tg.pile_size("tp") != 0) { return 228; }
    if (tg.pile_size("tp2") != 4) { return 229; }
    if (tg.get_card_in_pile("tp2", 0) !== c2) { return 230; }
    if (tg.get_card_in_pile("tp2", 1) !== c3) { return 231; }
    if (tg.get_card_in_pile("tp2", 2) !== c4) { return 232; }
    if (tg.get_card_in_pile("tp2", 3) !== c1) { return 233; }
    if (c2.stack != undefined) { return 234; }
    if (tp2ce.childNodes.length != 4) { return 235; }
    if (tp2ce.childNodes[0] !== c2.element) { return 236; }
    if (tp2ce.childNodes[1] !== c3.element) { return 237; }
    if (tp2ce.childNodes[2] !== c4.element) { return 238; }
    if (tp2ce.childNodes[3] !== c1.element) { return 239; }

    return true;
});

// Same-pile assignment
unit.register(function test_Game_same_pile_assignment() {
    let tg = setup_test_game();
    tg.create_pile("tp");
    if (tg.pile_size("tp") != 0) { return 1; }
    let c1 = tg.create_card("t1");
    let c2 = tg.create_card("t2");
    let c3 = tg.create_card("t3");
    tg.put_card_on_pile(c1, "tp");

    tg.stack_card_on_card(c3, c2);

    tg.insert_stack_into_pile_after(c2, c1);
    if (c2.stack.length != 1) { return 1; }
    if (c2.stack[0] !== c3) { return 2; }
    if (c3.stacked_on !== c2) { return 3; }
    if (c1.stack || c1.stacked_on) { return 4; }
    if (c1.pile != "tp") { return 5; }
    if (c2.pile != "tp") { return 6; }
    if (c3.pile != "tp") { return 7; }
    if (tg.pile_size("tp") != 3) { return 8; }
    if (tg.get_card_in_pile("tp", 0) !== c1) { return 9; }
    if (tg.get_card_in_pile("tp", 1) !== c2) { return 10; }
    if (tg.get_card_in_pile("tp", 2) !== c3) { return 11; }

    tg.insert_stack_into_pile_after(c2, c1);
    if (c2.stack.length != 1) { return 12; }
    if (c2.stack[0] !== c3) { return 13; }
    if (c3.stacked_on !== c2) { return 14; }
    if (c1.stack || c1.stacked_on) { return 15; }
    if (c1.pile != "tp") { return 16; }
    if (c2.pile != "tp") { return 17; }
    if (c3.pile != "tp") { return 18; }
    if (tg.pile_size("tp") != 3) { return 19; }
    if (tg.get_card_in_pile("tp", 0) !== c1) { return 20; }
    if (tg.get_card_in_pile("tp", 1) !== c2) { return 21; }
    if (tg.get_card_in_pile("tp", 2) !== c3) { return 22; }

    tg.put_stack_on_pile(c2, "tp");
    if (c2.stack.length != 1) { return 23; }
    if (c2.stack[0] !== c3) { return 24; }
    if (c3.stacked_on !== c2) { return 25; }
    if (c1.stack || c1.stacked_on) { return 26; }
    if (c1.pile != "tp") { return 27; }
    if (c2.pile != "tp") { return 28; }
    if (c3.pile != "tp") { return 29; }
    if (tg.pile_size("tp") != 3) { return 30; }
    if (tg.get_card_in_pile("tp", 0) !== c1) { return 31; }
    if (tg.get_card_in_pile("tp", 1) !== c2) { return 32; }
    if (tg.get_card_in_pile("tp", 2) !== c3) { return 33; }

    tg.put_stack_on_pile(c2, "tp");
    if (c2.stack.length != 1) { return 23; }
    if (c2.stack[0] !== c3) { return 24; }
    if (c3.stacked_on !== c2) { return 25; }
    if (c1.stack || c1.stacked_on) { return 26; }
    if (c1.pile != "tp") { return 27; }
    if (c2.pile != "tp") { return 28; }
    if (c3.pile != "tp") { return 29; }
    if (tg.pile_size("tp") != 3) { return 30; }
    if (tg.get_card_in_pile("tp", 0) !== c1) { return 31; }
    if (tg.get_card_in_pile("tp", 1) !== c2) { return 32; }
    if (tg.get_card_in_pile("tp", 2) !== c3) { return 33; }

    return true;
});

// TODO: Why does putting a stacked card up "delete" the card underneath?

/*
_remove_card_from_pile
_remove_stack_from_pile

remove_card_from_pile

remove_stack_from_pile

_stack_cards

stack_card_on_card

insert_stack_into_pile_after

insert_card_into_pile_after

put_card_on_pile


*/
