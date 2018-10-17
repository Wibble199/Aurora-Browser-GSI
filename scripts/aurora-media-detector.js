/* Script that detects video elements on the page and relays data to the core Aurora script
   which can then send this data to the Aurora application. */

/** The video properties that we actually care about. */
const desiredProperties = ["currentTime", "duration", "ended", "muted", "paused", "volume"];

const video = document.querySelector("video");
let videoState = {};

// If there is a video element on the page, add listeners to listen for it's state
if (video)
	["durationchange", "error", "pause", "playing", "progress", "seeked", "stalled", "suspend", "timeupdate", "volumechange", "waiting"]
		.forEach(evt => video.addEventListener(evt, updateVideoState));

/** Function that updates the core background script (that handles the Aurora data) with the new state for this video. */
function updateVideoState(evt) {
	videoState = pick(video, desiredProperties);
	browser.runtime.sendMessage({ videoState });
}
