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
document.querySelectorAll('ytd-reel-shelf-renderer').forEach(el => {
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