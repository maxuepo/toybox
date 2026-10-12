import "@fontsource/fraunces/400.css";
import "@fontsource/fraunces/400-italic.css";
import "@fontsource/fraunces/600.css";
import "./style.css";
import { CARDS, tileYield, withTile, type CardKind } from "./game/cards";
import { LIGHTHOUSE } from "./game/config";
import { fromKey, key, type Hex } from "./game/hex";
import { GameState, type DayReport } from "./game/state";
import { loadAssets } from "./render/assets";
import { renderCardArt } from "./render/cardArt";
import { World } from "./render/world";
import { Hud } from "./ui/hud";

async function main() {
  const loading = document.getElementById("loading")!;
  await loadAssets((done, total) => (loading.textContent = `Washing ashore… ${Math.round((done / total) * 100)}%`));
  loading.remove();

  const state = new GameState();
  const world = new World(document.getElementById("game")!);
  for (const [k, kind] of state.tiles) world.addTile(fromKey(k), kind, false);
  world.addLighthouse(LIGHTHOUSE);
  world.setWood(state.resources.wood);
  world.addCastaway("Rogue_Hooded", { q: 0, r: 0 }, { x: 0.55, z: 0.05, face: -2.2 }, "Sit_Floor_Idle");

  let hovered: Hex | null = null;
  let busy = false;

  const hud = new Hud(document.getElementById("hud")!, renderCardArt(Object.keys(CARDS) as CardKind[]), {
    onSelectCard(index) {
      world.showPlaceable(index === null ? null : state.placeableHexes());
      updatePrompt();
      refreshHover();
    },
    onRest() {
      if (busy) return;
      finishDay(state.rest(), "You rest by the fire.");
    },
  });

  const selectedKind = (): CardKind | undefined => {
    const i = hud.selectedCard;
    return i === null ? undefined : state.hand[i];
  };

  function updatePrompt() {
    const kind = selectedKind();
    hud.setPrompt(kind ? `Place the ${CARDS[kind].name}` : "Choose a tile card");
  }

  function refreshHover() {
    const kind = selectedKind();
    if (!kind || !hovered || !state.canPlaceAt(hovered)) {
      world.showGhost(null);
      hud.showPreview(null);
      return;
    }
    world.showGhost(hovered, kind);
    const gained = tileYield(withTile(state, hovered, kind), hovered, kind);
    hud.showPreview(world.toScreen(hovered, 1.4), gained);
  }

  function finishDay(report: DayReport, message?: string) {
    if (message) hud.toast(message);
    report.perTile.forEach(({ hex, gained }, i) => {
      const p = world.toScreen(hex, 0.9);
      hud.floatText(p.x, p.y, gained, 0.25 + i * 0.03);
    });
    for (const o of report.completed) {
      hud.objectiveComplete(o);
      if (o.id === "lighthouse") {
        hud.toast("A second castaway rows over from the lighthouse!", true);
        world.addCastaway("Barbarian", { q: 0, r: 0 }, { x: -0.05, z: 0.6, face: 2.6 }, "Cheer");
      }
    }
    world.setWood(state.resources.wood);
    hud.render(state);
    updatePrompt();
  }

  async function tryPlace(at: Hex) {
    const index = hud.selectedCard;
    const kind = selectedKind();
    if (index === null || !kind || busy) return;
    if (!state.canPlaceAt(at)) return;
    const report = state.place(index, at);
    if (!report) return;
    busy = true;
    hud.select(null);
    await world.addTile(at, kind, true);
    busy = false;
    finishDay(report);
  }

  // Treat a press-and-release without much movement as a click; drags orbit the camera.
  const canvas = world.renderer.domElement;
  let downAt: { x: number; y: number } | null = null;
  canvas.addEventListener("pointerdown", (e) => (downAt = { x: e.clientX, y: e.clientY }));
  canvas.addEventListener("pointerup", (e) => {
    if (!downAt || e.button !== 0) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    downAt = null;
    if (moved < 6) {
      const h = world.pickHex(e.clientX, e.clientY);
      if (h) tryPlace(h);
    }
  });
  canvas.addEventListener("pointermove", (e) => {
    const h = world.pickHex(e.clientX, e.clientY);
    if ((h && key(h)) !== (hovered && key(hovered))) hovered = h;
    refreshHover();
  });
  // Right-drag pans the camera, so keep the browser menu out of the way.
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  world.onFrame = () => {
    if (hovered && selectedKind()) refreshHover();
  };

  hud.render(state);
  updatePrompt();
  // Handy for poking at the game from the browser console.
  Object.assign(window, { game: { state, world, hud } });
}

main();
