/**
 * unit.js
 *
 * Simple unit testing module that picks up any function which starts
 * with "test_" (or a custom prefix of your choice) and runs each of
 * them, adding divs to the page to report their results and updating
 * various count elements if such exist.
 */

/*********************
 * Testing machinery *
 *********************/

/**
 * Module-global variable to hold all defined tests.
 */
var ALL_TESTS = [];

/**
 * Registers the given function as a new unit test. The function
 * registered this way should not be anonymous, as the function's name is
 * used as the name of the test when reporting results.
 *
 * If a unit test returns true, it counts as passing, and if it returns
 * any other value, including a truthy non-boolean value, it counts as
 * failing. You may take advantage of this to have a unit test return a
 * value which indicates why it failed, like a string or even just an
 * integer.
 */
export function register(test) {
    ALL_TESTS.push(test);
}

/**
 * Runs all registered unit tests, adding a div to the page for each
 * result and updating the #passed_count, #failed_count, and
 * #crashed_count elements with the respective counts if such elements
 * exist.
 */
export function run_all_tests() {
    // Run tests and add result reports to the page.
    let passed = 0;
    let failed = 0;
    let crashed = 0;
    for (let test of ALL_TESTS) {
        try {
            let result = test();
            if (typeof result == "boolean" && result) {
                passed += 1;
                document.body.innerHTML += (
                    "<div class='result pass'>PASSED: " + test.name + "</div>"
                );
            } else {
                failed += 1;
                if (typeof result == "boolean") {
                    document.body.innerHTML += (
                        "<div class='result fail'>FAILED: " + test.name+"</div>"
                    );
                } else {
                    document.body.innerHTML += (
                        "<div class='result fail'>FAILED: " + test.name + " ("
                      + result + ")</div>"
                    );
                }
            }
        } catch (e) {
            crashed += 1;
            console.error(e);
            document.body.innerHTML += (
                "<div class='result crash'>CRASHED: " + test.name + "</div>"
            );
        }
    }

    // Update counts in the page if they exist
    let pc = document.getElementById("passed_count");
    if (pc) { pc.innerHTML = passed; }
    let fc = document.getElementById("failed_count");
    if (fc) { fc.innerHTML = failed; }
    let cc = document.getElementById("crashed_count");
    if (cc) { cc.innerHTML = crashed; }
}

/****************
 * Test helpers *
 ****************/

/**
 * Generic object comparator that recursively handles nested objects.
 * Does not handle recursive objects well, so don't supply them.
 *
 * @param a The first object to compare.
 * @param b The second object to compare.
 */
export function same_obj(a, b) {
    if (typeof(a) != typeof(b)) {
        return false;
    } else if (typeof(a) == "object" && !(a instanceof String)) {
        // Object compare
        if (a instanceof String) {
            // Strings (ugh)
            return a.toString() == b.toString();
        } else if (Array.isArray(a)) {
            // Arrays
            if (!Array.isArray(b)) {
                return false;
            }
            if (a.length != b.length) {
                return false;
            }
            for (var i in a) {
                if (!same_obj(a[i], b[i])) {
                    return false;
                }
            }
            return true;
        } else {
            // Generic objects
            for (let key of Object.keys(a)) {
                if (!b.hasOwnProperty(key)) {
                    return false;
                } else if (!same_obj(a[key], b[key])) {
                    return false;
                }
            }
            for (let key of Object.keys(b)) {
                if (!a.hasOwnProperty(key)) {
                    return false;
                }
                // equality already checked in loop above
            }
            return true;
        }
    } else {
        // Primitive type compare, including strings
        return a == b;
    }
}

