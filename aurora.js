/** The tab properties that Aurora actually cares about.
 * See https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/Tab for a description of these properties. */
const desiredProperties = ["active", "attention", "audible", "pinned", "status", "title", "url", "windowId"];

let tabs = {};
let focusedWindow = -1;

initScan();
setupListeners();


/** Perform an initial scan of tabs and windows */
function initScan() {
    browser.tabs.query({}).then(list => {
        // Add tabs to an object by their tab ID
        tabs = {};
        list.forEach(tab => tabs[tab.id] = tab);
    });
    browser.windows.getAll().then(list => {
        // If any windows are focused, set that window's ID as the focusedWindow
        let focused = windows.find(wnd => wnd.focused);
        focusedWindow = focused ? focused.id : -1;
    });
}

/** Adds event listeners for window and tab APIs */
function setupListeners() {
    // Add event listeners for when windows focused/blured
    browser.windows.onFocusChanged.addListener(id => { focusedWindow = id; pushStateUpdate(); });

    // Add event listeners for when tabs created/focused/destroyed
    browser.tabs.onUpdated.addListener(
        (id, _, newState) => { tabs[id] = newState; pushStateUpdate(); },
        { properties: ["audible", "pinned", "status", "title"] } // Only trigger when one of these is updated (else it triggers on things like shareState which we don't care about)
    );
    browser.tabs.onActivated.addListener(({tabId, windowId}) => {
        Object.values(tabs) // For every tab
            .filter(tab => tab.windowId == windowId) // In the window being updated
            .forEach(tab => tab.active = tab.id == tabId) // Set tab's `active` to be true if it is the new active tab
        pushStateUpdate();
    });
    browser.tabs.onCreated.addListener(tab => { tabs[tab.id] = tab; pushStateUpdate(); });
    browser.tabs.onRemoved.addListener(id => { delete tabs[id]; pushStateUpdate(); });
    browser.tabs.onAttached.addListener((id, info) => { tabs[id].windowId = info.newWindowId; pushStateUpdate(); });
}

/** Picks certain properties from an object, discarding the rest.  */
function pickTabProps(obj) {
    let newObj =  {};
    desiredProperties.forEach(prop => newObj[prop] = obj[prop]);
    return newObj;
}

/** POSTs a state update to the Aurora endpoint. */
function pushStateUpdate() {
    // TODO: send update to Aurora endpoint
    console.clear();
    console.log(JSON.stringify(generateStateObject(), null, 4));
}

/** Generates the state object to send to Aurora. */
function generateStateObject() {
    return {
        focusedWindow,
        tabs: Object.keys(tabs)
            .map(tabId => pickTabProps(tabs[tabId]))
    };
}