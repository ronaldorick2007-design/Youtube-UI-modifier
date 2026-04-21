
//content script for applying glass effect to header
const style = document.createElement("style");

style.innerHTML = `

/* apply glass */
ytd-masthead #container {
    background: rgba(255, 255, 255, 0.03) !important;
    backdrop-filter: blur(18px) !important;
    -webkit-backdrop-filter: blur(18px) !important;
    border-bottom: 1px solid rgba(255,255,255,0.08) !important;
}

/* remove extra overlays */
#background, #masthead-container {
    background: transparent !important;
}`;

document.head.appendChild(style);


//content script for blocking youtube elements
function blockShorts(){
//Remove shorts shelf in search page
const item = ".ytGridShelfViewModelHost";
document.querySelectorAll(item).forEach(el => {
    el.remove();
});
//Removes shorts cards from search page
document.querySelectorAll('ytd-video-renderer').forEach(card => {
    const link = card.querySelector('a[href*="/shorts/"]');

    if (link) {
        card.remove();
    }
});
//Removes shorts shelf in recommedations
document.querySelectorAll('ytd-feed-nudge-renderer').forEach(el => {
    el.remove();
});
//Remove recommendation videos
document.querySelectorAll('ytd-watch-next-secondary-results-renderer').forEach(el => {
    el.remove();
});
//Remove comments section
document.querySelectorAll('.style-scope ytd-comments').forEach(el => {
    el.remove();
});

}

const observer = new MutationObserver(blockShorts);

observer.observe(document.body, {childList: true, subtree: true});