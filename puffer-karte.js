// puffer-karte v1.0.1
// Einzeln installierbares Modul (Home Assistant Marketplace / HACS, Kategorie Dashboard).
window.customCards = window.customCards || [];
window.customCardFeatures = window.customCardFeatures || [];
// Eigener Block: Namen bleiben lokal, auch wenn mehrere Karten zusammen geladen werden.
{
// ---------------------------------------------------------------------------
// Puffer-Karte: zeichnet einen Pufferspeicher mit Temperaturverlauf (oben warm, unten kalt),
// Ladezustand und Pufferpumpe.
//
//   type: custom:puffer-karte
//   titel: Puffer Altbau
//   oben: sensor.puffer_temperatur_oben
//   mitte: sensor.puffer_temperatur_mitte   # optional
//   unten: sensor.puffer_temperatur_unten
//   ladezustand: sensor.puffer_ladezustand  # optional, %
//   pumpe: sensor.puffer_pufferpumpen_ansteuerung  # optional (% oder an/aus)
//   min: 20, max: 90          # optional, Farbskala blau..rot in °C
//   ungueltig_ab: 120         # optional, Werte darueber gelten als "kein Fuehler"
//   waerme: sensor.puffer_altbau_warmeinhalt              # optional, kWh
//   leistung: sensor.puffer_altbau_leistung_netto         # optional, kW (+ laden / - entladen)
//   entnahme_heute: sensor.puffer_altbau_entnahme_heute   # optional, kWh
//   entnahme_gesamt: sensor.puffer_altbau_entnahme_gesamt # optional, kWh

const TYPE5 = "puffer-karte";

class PufferKarte extends HTMLElement {
  setConfig(config) {
    if (!config?.oben || !config?.unten) throw new Error("oben und unten werden benoetigt");
    this._config = { min: 20, max: 90, ungueltig_ab: 120, ...config };
    this._uid = Math.random().toString(36).slice(2, 9);
    this._render();
  }

  set hass(hass) { this._hass = hass; this._update(); }

  _wert(id) {
    const s = id && this._hass?.states[id];
    const v = s ? Number(s.state) : NaN;
    if (isNaN(v) || v >= this._config.ungueltig_ab || v < -30) return null;
    return v;
  }

  _farbe(t) {
    const c = this._config;
    const x = Math.min(1, Math.max(0, (t - c.min) / (c.max - c.min)));
    return `hsl(${Math.round(220 - 220 * x)}, 80%, 48%)`;
  }

  _info(id) {
    if (!id) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: id }, bubbles: true, composed: true }));
  }

  _render() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    const u = this._uid;
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card { padding: 12px 16px 14px; height: 100%; box-sizing: border-box; }
        .kopf { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .titel { flex: 1; font-size: 15px; font-weight: 500; color: var(--primary-text-color); }
        .ladung { font-size: 15px; font-weight: 600; color: var(--primary-text-color); cursor: pointer; }
        .pumpe { --mdc-icon-size: 20px; color: var(--disabled-text-color); cursor: pointer; display: flex; align-items: center; gap: 2px; font-size: 12px; }
        .pumpe.an { color: var(--state-active-color, var(--amber-color, #ffc107)); }
        .pumpe.an ha-icon { animation: dreh 1.6s linear infinite; }
        @keyframes dreh { to { transform: rotate(360deg); } }
        .inhalt { display: flex; gap: 14px; align-items: stretch; }
        svg { width: 74px; height: 170px; flex: none; }
        .werte { flex: 1; position: relative; min-height: 170px; }
        .wert { position: absolute; left: 0; right: 0; transform: translateY(-50%); display: flex; align-items: baseline; gap: 8px; cursor: pointer; }
        .wert .l { font-size: 12px; color: var(--secondary-text-color); width: 42px; }
        .wert .v { font-size: 18px; font-weight: 600; color: var(--primary-text-color); }
        .wert .p { width: 10px; height: 10px; border-radius: 50%; align-self: center; flex: none; }
        .hinweis { position: absolute; bottom: 0; left: 0; font-size: 11px; color: var(--secondary-text-color); }
        .ww { display: none; align-items: center; gap: 6px; margin: -2px 0 8px; cursor: pointer; }
        .ww.an { display: flex; }
        .ww ha-icon { --mdc-icon-size: 18px; color: #29b6f6; }
        .ww .wl { font-size: 12px; color: var(--secondary-text-color); }
        .ww .wv { font-size: 16px; font-weight: 600; color: var(--primary-text-color); }
        .ww .wsoll { font-size: 12px; color: var(--secondary-text-color); margin-left: auto; }
        .en { display: none; grid-template-columns: repeat(auto-fit, minmax(86px, 1fr)); gap: 6px; margin-top: 10px; }
        .en.an { display: grid; }
        .en .k { border-radius: 8px; padding: 6px 8px; background: color-mix(in srgb, var(--primary-text-color) 5%, transparent); cursor: pointer; min-width: 0; }
        .en .t { font-size: 11px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .en .w { font-size: 15px; font-weight: 600; color: var(--primary-text-color); white-space: nowrap; }
        .en .w.laden { color: #ef6c00; } .en .w.entladen { color: #1e88e5; }
        .rohr { display: none; }
        .kombi .rohr { display: inline; }
      </style>
      <ha-card>
        <div class="kopf">
          <span class="titel"></span>
          <span class="ladung"></span>
          <span class="pumpe"><ha-icon icon="mdi:pump"></ha-icon><span class="pt"></span></span>
        </div>
        <div class="ww"><ha-icon icon="mdi:water-thermometer"></ha-icon><span class="wl">Warmwasser</span><span class="wv"></span><span class="wsoll"></span></div>
        <div class="inhalt">
          <svg viewBox="0 0 74 170">
            <defs>
              <linearGradient id="g-${u}" x1="0" y1="0" x2="0" y2="1"></linearGradient>
              <clipPath id="c-${u}"><rect x="6" y="4" width="62" height="162" rx="22"/></clipPath>
            </defs>
            <rect x="6" y="4" width="62" height="162" rx="22" fill="url(#g-${u})"/>
            <rect class="leer" clip-path="url(#c-${u})" x="6" y="166" width="62" height="0" fill="#000" opacity="0.45"/>
            <line class="grenze" x1="6" x2="68" y1="166" y2="166" stroke="#fff" stroke-width="1.5" stroke-dasharray="4 3" opacity="0"/>
            <g class="rohr" clip-path="url(#c-${u})">
              <path d="${this._wellrohr()}" fill="none" stroke="#263238" stroke-opacity=".35" stroke-width="5" stroke-linecap="round"/>
              <path d="${this._wellrohr()}" fill="none" stroke="#eceff1" stroke-opacity=".85" stroke-width="2.6" stroke-linecap="round"/>
            </g>
            <rect x="6" y="4" width="62" height="162" rx="22" fill="none" stroke="var(--divider-color, #888)" stroke-width="2"/>
          </svg>
          <div class="werte"></div>
        </div>
        <div class="en"></div>
      </ha-card>`;
    this.shadowRoot.querySelector(".titel").textContent = this._config.titel || "Puffer";
    this.shadowRoot.querySelector(".inhalt").classList.toggle("kombi", !!this._config.kombi);
    this.shadowRoot.querySelector(".ww").addEventListener("click", () => this._info(this._config.warmwasser));
    this.shadowRoot.querySelector(".ladung").addEventListener("click", () => this._info(this._config.ladezustand));
    this.shadowRoot.querySelector(".pumpe").addEventListener("click", () => this._info(this._config.pumpe));
    this._update();
  }

  // Edelstahl-Wellrohr des Hygienekombispeichers (Frischwasser kalt unten rein, warm oben raus)
  _wellrohr() {
    let d = "M37 168 L37 156";
    for (let i = 0, y = 156; y > 14; i++, y -= 10) d += ` Q ${i % 2 ? 19 : 55} ${y - 5} 37 ${y - 10}`;
    return d + " L37 2";
  }

  _update() {
    if (!this._hass || !this.shadowRoot || !this._config) return;
    const c = this._config, r = this.shadowRoot;
    // Warmwasser (Hygienekombispeicher)
    const ww = r.querySelector(".ww"), twv = this._wert(c.warmwasser), tws = c.warmwasser_soll ? Number(this._hass.states[c.warmwasser_soll]?.state) : NaN;
    ww.classList.toggle("an", !!c.warmwasser);
    if (c.warmwasser) {
      r.querySelector(".wv").textContent = twv != null ? `${twv.toLocaleString("de-DE", { maximumFractionDigits: 1 })} °C` : "–";
      r.querySelector(".wv").style.color = twv != null && !isNaN(tws) && twv < tws - 5 ? "#e53935" : "";
      r.querySelector(".wsoll").textContent = !isNaN(tws) ? `Soll ${Math.round(tws)} °C` : "";
    }
    // Fuehler von oben nach unten mit ihrer Hoehe im Speicher (0 = oben, 1 = unten)
    const fuehler = [["oben", c.oben, 0.12], ["mitte", c.mitte, 0.5], ["unten", c.unten, 0.88]]
      .filter(([, id]) => id).map(([l, id, pos]) => ({ l, id, pos, t: this._wert(id) }));
    const gueltig = fuehler.filter((f) => f.t != null);

    const grad = r.getElementById(`g-${this._uid}`);
    grad.innerHTML = gueltig.length
      ? gueltig.map((f) => `<stop offset="${f.pos}" stop-color="${this._farbe(f.t)}"/>`).join("")
      : `<stop offset="0" stop-color="var(--disabled-text-color)"/>`;

    const werte = r.querySelector(".werte");
    werte.innerHTML = "";
    for (const f of fuehler) {
      const d = document.createElement("div");
      d.className = "wert";
      d.style.top = `${f.pos * 100}%`;
      const einheit = this._hass.states[f.id]?.attributes?.unit_of_measurement || "°C";
      d.innerHTML = `<span class="p"></span><span class="l"></span><span class="v"></span>`;
      d.querySelector(".p").style.background = f.t != null ? this._farbe(f.t) : "var(--disabled-text-color)";
      d.querySelector(".l").textContent = f.l;
      d.querySelector(".v").textContent = f.t != null ? `${f.t.toLocaleString("de-DE", { maximumFractionDigits: 1 })} ${einheit}` : "kein Fühler";
      d.addEventListener("click", () => this._info(f.id));
      werte.appendChild(d);
    }
    const spreizung = gueltig.length >= 2 ? Math.abs(gueltig[0].t - gueltig[gueltig.length - 1].t) : null;
    if (spreizung != null) {
      const h = document.createElement("div");
      h.className = "hinweis";
      h.textContent = `Spreizung ${spreizung.toLocaleString("de-DE", { maximumFractionDigits: 1 })} K`;
      werte.appendChild(h);
    }

    // Ladezustand: geladener Teil von oben, ungeladener Teil unten abgedunkelt
    const lz = c.ladezustand ? Number(this._hass.states[c.ladezustand]?.state) : NaN;
    const leer = r.querySelector(".leer"), grenze = r.querySelector(".grenze");
    if (!isNaN(lz)) {
      const anteil = Math.min(100, Math.max(0, lz)) / 100;
      const hLeer = 162 * (1 - anteil);
      leer.setAttribute("y", String(166 - hLeer));
      leer.setAttribute("height", String(hLeer));
      grenze.setAttribute("y1", String(166 - hLeer));
      grenze.setAttribute("y2", String(166 - hLeer));
      grenze.setAttribute("opacity", anteil > 0 && anteil < 1 ? "0.8" : "0");
      r.querySelector(".ladung").textContent = `Ladezustand ${Math.round(lz)} %`;
    } else {
      leer.setAttribute("height", "0");
      grenze.setAttribute("opacity", "0");
      r.querySelector(".ladung").textContent = "";
    }

    // Waermeinhalt, Lade-/Entnahmeleistung und Entnahme-Zaehler (alle optional)
    const en = r.querySelector(".en");
    const kacheln = [["Wärmeinhalt", c.waerme, 1], ["Leistung", c.leistung, 1, true], ["Entnahme heute", c.entnahme_heute, 1], ["Entnahme gesamt", c.entnahme_gesamt, 0]]
      .filter(([, id]) => id && this._hass.states[id]);
    en.classList.toggle("an", kacheln.length > 0);
    en.innerHTML = "";
    for (const [t, id, st, vorzeichen] of kacheln) {
      const s = this._hass.states[id], v = Number(s.state), e = s.attributes?.unit_of_measurement || "";
      const art = vorzeichen && !isNaN(v) ? (v > 0.05 ? "laden" : v < -0.05 ? "entladen" : "") : "";
      const k = document.createElement("div");
      k.className = "k";
      k.innerHTML = `<div class="t"></div><div class="w"></div>`;
      k.querySelector(".t").textContent = art === "laden" ? "wird geladen" : art === "entladen" ? "wird entladen" : t;
      const w = k.querySelector(".w");
      w.textContent = isNaN(v) ? "–" : `${art === "laden" ? "+" : ""}${v.toLocaleString("de-DE", { minimumFractionDigits: st, maximumFractionDigits: st })} ${e}`.trim();
      if (art) w.classList.add(art);
      k.addEventListener("click", () => this._info(id));
      en.appendChild(k);
    }

    // Pumpe: Prozentwert oder an/aus
    const pumpe = r.querySelector(".pumpe");
    const ps = c.pumpe ? this._hass.states[c.pumpe] : null;
    pumpe.style.display = ps ? "" : "none";
    if (ps) {
      const n = Number(ps.state);
      const an = !isNaN(n) ? n > 0 : ps.state === "on";
      pumpe.classList.toggle("an", an);
      r.querySelector(".pt").textContent = !isNaN(n) && an ? `${Math.round(n)} %` : "";
      pumpe.title = an ? "Pufferpumpe läuft" : "Pufferpumpe aus";
    }
  }

  getCardSize() { return 4; }
  getGridOptions() { return { columns: 6, rows: "auto", min_columns: 4 }; }
  static getStubConfig() { return { titel: "Puffer", oben: "", unten: "" }; }
}

if (!customElements.get(TYPE5)) customElements.define(TYPE5, PufferKarte);
if (!window.customCards.some((c) => c.type === TYPE5)) {
  window.customCards.push({ type: TYPE5, name: "Puffer-Karte", description: "Pufferspeicher mit Temperaturverlauf, Ladezustand und Pumpe", preview: true });
}

// Eingabemaske (visueller Editor) und Startwerte
{
  const ids = (hass) => Object.keys(hass?.states ?? {});
  const finde = (hass, re, dom = "sensor.") => ids(hass).find((id) => id.startsWith(dom) && re.test(id)) || "";
  const ent = (domain, extra = {}) => ({ entity: { filter: { domain, ...extra } } });
  const nummer = (min, max, step = 1, unit) => ({ number: { min, max, step, mode: "box", ...(unit ? { unit_of_measurement: unit } : {}) } });
  const auswahl = (opts) => ({ select: { mode: "dropdown", options: opts.map(([value, label]) => ({ value, label })) } });
  const text = { text: {} };
  const formular = (schema, labels, hilfen = {}) => () => ({
    schema,
    computeLabel: (s) => labels[s.name] ?? s.name,
    computeHelper: (s) => hilfen[s.name],
  });
  const setze = (typ, form, stub) => {
    const K = customElements.get(typ);
    if (!K) return;
    if (form) K.getConfigForm = form;
    if (stub) K.getStubConfig = (hass) => Object.fromEntries(Object.entries(stub(hass)).filter(([, v]) => v !== ""));
  };
  setze("puffer-karte",
    formular([
      { name: "titel", selector: text },
      { name: "oben", required: true, selector: ent("sensor") },
      { name: "mitte", selector: ent("sensor") },
      { name: "unten", required: true, selector: ent("sensor") },
      { name: "ladezustand", selector: ent("sensor") },
      { name: "pumpe", selector: ent(["sensor", "binary_sensor", "switch"]) },
      { name: "kombi", selector: { boolean: {} } },
      { name: "warmwasser", selector: ent("sensor") },
      { name: "warmwasser_soll", selector: ent(["number", "input_number", "sensor"]) },
      { name: "waerme", selector: ent("sensor") },
      { name: "leistung", selector: ent("sensor") },
      { name: "entnahme_heute", selector: ent("sensor") },
      { name: "entnahme_gesamt", selector: ent("sensor") },
      { type: "grid", name: "", schema: [
        { name: "min", selector: nummer(-20, 100, 1, "°C") },
        { name: "max", selector: nummer(0, 150, 1, "°C") },
        { name: "ungueltig_ab", selector: nummer(50, 1000, 1, "°C") },
      ] },
    ], { titel: "Titel", oben: "Fühler oben", mitte: "Fühler Mitte (optional)", unten: "Fühler unten",
      ladezustand: "Ladezustand % (optional)", pumpe: "Pufferpumpe (optional)", min: "Farbskala von", max: "Farbskala bis",
      ungueltig_ab: "Ungültig ab", kombi: "Hygienekombispeicher (Warmwasser-Wellrohr zeichnen)",
      warmwasser: "Warmwasser-Temperatur (optional)", warmwasser_soll: "Warmwasser-Solltemperatur (optional)",
      waerme: "Wärmeinhalt kWh (optional)", leistung: "Leistung netto kW, + laden / − entladen (optional)",
      entnahme_heute: "Entnahme heute kWh (optional)", entnahme_gesamt: "Entnahme gesamt kWh (optional)" },
    { ungueltig_ab: "Werte ab hier gelten als „kein Fühler“", min: "Blau bei dieser Temperatur", max: "Rot bei dieser Temperatur" }),
    (hass) => ({ titel: "Puffer", oben: finde(hass, /puffer.*oben/), mitte: finde(hass, /puffer.*mitte/),
      unten: finde(hass, /puffer.*unten/), ladezustand: finde(hass, /puffer.*ladezustand/), pumpe: finde(hass, /puffer.*pumpe/) }));
}
}

console.info("%c puffer-karte %c v1.0.0 ", "color:#fff;background:#03a9f4;font-weight:700", "color:#03a9f4");
