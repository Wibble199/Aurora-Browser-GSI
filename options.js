document.addEventListener("DOMContentLoaded", loadSettings);
document.querySelector("form").addEventListener("submit", saveSettings);

async function loadSettings() {
    let settings = await browser.storage.local.get({
        port: 9088
    });

    el("port").value = settings.port;
}

function saveSettings(e) {
    e.preventDefault();

    browser.storage.local.set({
        port: el("port").value
    });
}

function el(id) { return document.getElementById(id); }