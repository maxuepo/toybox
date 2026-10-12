import { CARDS, type CardKind } from "../game/cards";
import { RESOURCES, RESOURCE_ICON, STORAGE_CAP, type Resources } from "../game/config";
import { OBJECTIVES, type GameState, type Objective } from "../game/state";

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

export interface HudHandlers {
  onSelectCard(index: number | null): void;
  onRest(): void;
}

/** The DOM overlay: resource bar, objectives, prompt, hand of cards and floating labels. */
export class Hud {
  private resourceBar = el("div", "panel resources");
  private dayLabel = el("div", "day");
  private objectives = el("div", "panel objectives");
  private prompt = el("div", "prompt");
  private hand = el("div", "hand");
  private restButton = el("button", "rest", "Rest a day");
  private toasts = el("div", "toasts");
  private selected: number | null = null;

  constructor(
    private root: HTMLElement,
    private art: Record<CardKind, string>,
    private handlers: HudHandlers,
  ) {
    const topLeft = el("div", "top-left");
    topLeft.append(this.resourceBar, this.objectives);
    this.restButton.title = "Skip placing a tile. The island still produces, and you draw a new hand.";
    this.restButton.addEventListener("click", () => handlers.onRest());
    root.append(topLeft, this.dayLabel, this.prompt, this.hand, this.restButton, this.toasts);
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.select(null);
      if (e.key === "1" || e.key === "2") this.select(Number(e.key) - 1);
    });
  }

  get selectedCard() {
    return this.selected;
  }

  select(index: number | null) {
    this.selected = index;
    [...this.hand.children].forEach((c, i) => c.classList.toggle("selected", i === index));
    this.handlers.onSelectCard(index);
  }

  setPrompt(text: string) {
    this.prompt.textContent = text;
  }

  render(state: GameState) {
    this.resourceBar.replaceChildren(
      ...RESOURCES.map((r) => {
        const item = el("div", "res");
        item.append(el("span", "icon", RESOURCE_ICON[r]), el("b", "", String(state.resources[r])), el("small", "", `/${STORAGE_CAP[r]}`));
        if (state.resources[r] >= STORAGE_CAP[r]) item.classList.add("full");
        return item;
      }),
    );
    this.dayLabel.textContent = `Day ${state.day}`;
    this.renderObjectives(state);
    this.renderHand(state);
  }

  private renderObjectives(state: GameState) {
    const head = el("div", "objectives-head");
    head.append(el("span", "", "Objectives"), el("small", "", `${state.done.size}/${OBJECTIVES.length}`));
    const list = OBJECTIVES.map((o) => {
      const [have, need] = o.progress(state);
      const done = state.done.has(o.id);
      const row = el("div", `objective${done ? " done" : ""}`);
      const text = el("div", "objective-text");
      text.append(el("div", "objective-title", o.title), el("div", "objective-hint", o.hint));
      row.append(el("span", "check", done ? "✓" : ""), text);
      if (need > 1 && !done) row.append(el("span", "objective-progress", `${have}/${need}`));
      return row;
    });
    this.objectives.replaceChildren(head, ...list);
  }

  private renderHand(state: GameState) {
    this.hand.replaceChildren(
      ...state.hand.map((kind, i) => {
        const def = CARDS[kind];
        const card = el("button", "card");
        card.style.setProperty("--tilt", `${(i - (state.hand.length - 1) / 2) * 4}deg`);
        const affordable = state.canAfford(kind);
        if (!affordable) card.classList.add("unaffordable");
        const art = el("img", "card-art");
        art.src = this.art[kind];
        art.alt = "";
        const costs = el("div", "costs");
        for (const r of RESOURCES) {
          const amount = def.cost[r];
          if (!amount) continue;
          const chip = el("span", "chip", `${RESOURCE_ICON[r]} ${amount}`);
          if (state.resources[r] < amount) chip.classList.add("short");
          costs.append(chip);
        }
        card.append(el("div", "ribbon", def.name), art, costs, el("p", "card-text", def.text));
        card.addEventListener("click", () => {
          if (!affordable) {
            this.toast("Not enough resources. Rest a day to gather more.");
            return;
          }
          this.select(this.selected === i ? null : i);
        });
        return card;
      }),
    );
    this.selected = null;
  }

  /** Rising "+2 🪵" style label at a screen position. */
  floatText(x: number, y: number, gained: Partial<Resources>, delay = 0) {
    const parts = RESOURCES.filter((r) => gained[r]).map((r) => `+${gained[r]} ${RESOURCE_ICON[r]}`);
    if (!parts.length) return;
    const label = el("div", "float", parts.join("  "));
    label.style.left = `${x}px`;
    label.style.top = `${y}px`;
    label.style.animationDelay = `${delay}s`;
    this.root.append(label);
    setTimeout(() => label.remove(), 1800 + delay * 1000);
  }

  /** A label that follows the cursor's hovered hex, showing what a placement would yield. */
  readonly preview = el("div", "preview");

  showPreview(pos: { x: number; y: number } | null, gained?: Partial<Resources>) {
    if (!pos || !gained) {
      this.preview.remove();
      return;
    }
    const parts = RESOURCES.filter((r) => gained[r]).map((r) => `+${gained[r]} ${RESOURCE_ICON[r]}`);
    this.preview.textContent = `${parts.join("  ") || "nothing"} / day`;
    this.preview.style.left = `${pos.x}px`;
    this.preview.style.top = `${pos.y}px`;
    if (!this.preview.isConnected) this.root.append(this.preview);
  }

  objectiveComplete(o: Objective) {
    this.toast(`Objective complete: ${o.title}`, true);
  }

  toast(text: string, good = false) {
    const t = el("div", `toast${good ? " good" : ""}`, text);
    this.toasts.append(t);
    setTimeout(() => t.remove(), 3200);
  }
}
