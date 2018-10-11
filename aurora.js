/** The tab properties that Aurora actually cares about.
 * See https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/Tab for a description of these properties. */
const desiredProperties = ["active", "attention", "audible", "pinned", "status", "title", "url", "windowId"];

let tabs = {};
let focusedWindow = -1;
let settings = {};

loadSettings();
initScan();
setupListeners();


/** Fetches the app's settings from the storage API. */
function loadSettings() {
    browser.storage.local.get({
        port: 9088
    }).then(s => settings = s);
}

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
    browser.windows.onFocusChanged.addListener(u(id => focusedWindow = id));

    // Add event listeners for when tabs created/focused/destroyed
    browser.tabs.onActivated.addListener(u(setActiveTab));
    browser.tabs.onAttached.addListener(u((id, info) => tabs[id].windowId = info.newWindowId));
    browser.tabs.onCreated.addListener(u(tab => tabs[tab.id] = tab));
    browser.tabs.onRemoved.addListener(u(id => delete tabs[id])); 
    browser.tabs.onUpdated.addListener(u((id, _, newState) => tabs[id] = newState), { properties: ["audible", "pinned", "status", "title"] });   
}

/** Simple wrapper to prettify the listener functions.
 * Runs a function that calls the given function then calls pushStateUpdate. */
function u(fn) {
    return function() {
        fn.apply(null, arguments);
        pushStateUpdate();
    }
}

/** Sets the active tab for the given window. */
function setActiveTab({tabId, windowId}) {
    Object.values(tabs) // For every tab
        .filter(tab => tab.windowId == windowId) // Only include target windowId since each window has an active tab
        .forEach(tab => tab.active = tab.id == tabId) // Set tab's `active` to be true if it is the new active tab
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
    fetch(`http://localhost:${settings.port}/`, {
        method: "POST",
        body: JSON.stringify(generateStateObject())
    });
}

/** Generates the state object to send to Aurora. */
function generateStateObject() {
    return {
        provider: {
            name: "webbrowser",
            appid: -1
        },
        browser: {
            focusedWindow,
            tabs: Object.keys(tabs)
                .map(tabId => pickTabProps(tabs[tabId]))
        }
    };
}