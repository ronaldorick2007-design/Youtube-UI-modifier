const style = document.createElement('style');
style.textContent = `
  /* =========================
     GLOBAL THUMBNAIL BLACKOUT (ALL PAGES)
     ========================= */

  /* Normalize all thumbnail containers */
  ytd-thumbnail,
  ytd-playlist-thumbnail,
  .ytThumbnailViewModelImage,
  .ytp-videowall-still-image {
    position: relative !important;
    overflow: hidden !important;
  }

  /* Single unified black cover */
  ytd-thumbnail::after,
  ytd-playlist-thumbnail::after,
  .ytThumbnailViewModelImage::after,
  .ytp-videowall-still-image::after {
    content: "";
    position: absolute;
    inset: 0;
    background: black;
    z-index: 9999;
    pointer-events: none;
  }
`;

document.head.appendChild(style);

console.log("YouTube Shroud: unified global blackout.");