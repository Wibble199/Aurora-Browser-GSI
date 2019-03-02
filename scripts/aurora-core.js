/* Main background script that handles aggregating the data and updating the Aurora endpoint with the new
   data. Also responsible for watching changes in tabs and downloads. */
   
/** The tab properties that Aurora actually cares about.
 * See https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/Tab for a description of these properties. */
const desiredTabProperties = ["active", "attention", "audible", "favIconUrl", "pinned", "status", "title", "url", "windowId"];

/** The download properties that Aurora cares about.
 * See https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/downloads/DownloadItem */
const desiredDownloadProperties = ["bytesReceived", "estimatedEndTime", "filename", "id", "paused", "startTime", "state", "totalBytes"];

let tabs = {};
let focusedWindow = -1;
let videos = {};
let downloads = [];
let downloadUpdateIntervalId = -1;
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
        let focused = list.find(wnd => wnd.focused);
        focusedWindow = focused ? focused.id : -1;
    });

    updateDownloadList();
}

/** Adds event listeners for window and tab APIs */
function setupListeners() {
    // Add event listeners for when windows focused/blured
    browser.windows.onFocusChanged.addListener(u(id => {focusedWindow = id; console.log("Focussed window changed: " + id)}));

    // Add event listeners for when tabs created/focused/destroyed
    browser.tabs.onActivated.addListener(u(setActiveTab));
    browser.tabs.onAttached.addListener(u((id, info) => tabs[id].windowId = info.newWindowId));
    browser.tabs.onCreated.addListener(u(tab => tabs[tab.id] = tab));
    browser.tabs.onRemoved.addListener(u(id => { delete tabs[id]; delete videos[id] })); 
    browser.tabs.onUpdated.addListener(u((id, _, newState) => tabs[id] = newState)); // There was an event filter on here for { properties: ["audible", "pinned", "status", "title"] }, but Chrome does not support them here >:(

    // Add listeners for downloads
    browser.downloads.onCreated.addListener(updateDownloadList);
    browser.downloads.onChanged.addListener(updateDownloadList);
    browser.downloads.onErased.addListener(updateDownloadList);

    // Add listener for content script messages (e.g. media detection)
    browser.runtime.onMessage.addListener(handleIncomingMessage)
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

/** Completely clears and updates the download list. */
function updateDownloadList() {
    browser.downloads.search({}).then(list => {
        // Add downloads to the object by their ID
        downloads = list;

        // If atleast one download is running, periodically update the list
        // This is required since `downloads.onChanged` doesn't fire for `bytesRecieved` update
        if (list.some(dl => dl.state == "in_progress"))
            startUpdatingDlList();
        else
            stopUpdatingDlList();

        // After updating the list, push the new state.
        pushStateUpdate();
    });
}

/** Starts a periodic download list update if not already running. */
function startUpdatingDlList() {
    if (downloadUpdateIntervalId == -1)
        downloadUpdateIntervalId = setInterval(updateDownloadList, 1000);
}

/** Stops the periodic download list update if it's running. */
function stopUpdatingDlList() {
    if (downloadUpdateIntervalId != -1) {
        clearInterval(downloadUpdateIntervalId);
        downloadUpdateIntervalId = -1;
    }
}

/** Function that handles any incoming message from content scripts and updates the core state. */
function handleIncomingMessage(data, sender, response) {
    // If the content script is giving us video state data, update that relevant data
    if (data.videoState)
        videos[sender.tab.id] = data.videoState;

    // After updating our core state, push it to Aurora
    pushStateUpdate();
}

/** POSTs a state update to the Aurora endpoint. */
function pushStateUpdate() {
    fetch(`http://localhost:${settings.port}/`, {
        method: "POST",
        body: JSON.stringify(generateStateObject())
    });
}

/** Generates the state object to send to Aurora. */
function generateStateObject() {
    return {
        provider: {
            name: "firefox.exe",
            appid: -1
        },
        pages: {
            focusedWindow,
            tabs: Object.keys(tabs)
                .map(tabId => {
                    let tabData = pick(tabs[tabId], desiredTabProperties);
                    tabData.video = videos[tabId] || null;
                    return tabData;
                })
        },
        downloads: downloads
            .map(dl => pick(dl, desiredDownloadProperties))
    };
}
