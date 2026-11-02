
(() => {
  const spriteURL =
    "https://img.pokemondb.net/sprites/scarlet-violet/normal/bulbasaur.png";

  const scrubber = document.querySelector(".ytp-scrubber-button");
  if (!scrubber) return;

  document.querySelector("#pokemon-scrubber-sprite")?.remove();
  document.querySelector("#pokemon-scrubber-style")?.remove();

  const style = document.createElement("style");
  style.id = "pokemon-scrubber-style";
  style.textContent = `
    .ytp-scrubber-button {
      background: transparent !important;
      border-radius: 0 !important;
      box-shadow: none !important;
    }

    #pokemon-scrubber-sprite {
      position: absolute;
      width: 70px;
      height: 70px;
      object-fit: contain;
      left: 50%;
      top: -150%;
      transform: translate(-50%, -50%) scaleX(-1);
      pointer-events: none;
      z-index: 10;
      filter: drop-shadow(0 2px 3px #0008);
    }
  `;

  document.head.appendChild(style);

  const sprite = document.createElement("img");
  sprite.id = "pokemon-scrubber-sprite";
  sprite.src = spriteURL;
  sprite.alt = "Bulbasaur";
  sprite.draggable = false;

  scrubber.appendChild(sprite);
})();
