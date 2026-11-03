import { filterProducts, money, normalizeProduct, saveDb } from "./catalog.js";
import { state } from "./state.js";

const METAL = { gold: "#c6a36a", silver: "#c5ccd4", rose: "#d7a194", pearl: "#f3ece4" };

export function bindUi() {
  renderFilters();
  renderProducts();
  renderDetail();
  renderComments();
  document.getElementById("search").addEventListener("input", (event) => {
    state.filter.q = event.target.value;
    renderProducts();
  });
  document.getElementById("filters").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-group]");
    if (!button) return;
    state.filter[button.dataset.group] = button.dataset.value;
    renderFilters();
    renderProducts();
  });
  document.getElementById("product-list").addEventListener("click", (event) => {
    const card = event.target.closest("[data-id]");
    if (!card) return;
    selectProduct(card.dataset.id);
  });
  document.getElementById("comment-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const author = document.getElementById("comment-author").value.trim().slice(0, 40) || "Guest";
    const text = document.getElementById("comment-text").value.trim().slice(0, 400);
    if (!text || !state.selectedId) return;
    state.comments.unshift({
      id: `c-${Date.now()}`,
      productId: state.selectedId,
      author,
      text,
      ts: Date.now(),
    });
    document.getElementById("comment-text").value = "";
    persist();
    renderComments();
  });
  document.getElementById("comments").addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-comment]");
    if (!button) return;
    state.comments = state.comments.filter((comment) => comment.id !== button.dataset.removeComment);
    persist();
    renderComments();
  });
  bindFit();
  bindAdmin();
}

export function selectProduct(id) {
  state.selectedId = id;
  state.swing.left = { angle: 0, vel: 0, lastY: 0, lastT: 0 };
  state.swing.right = { angle: 0, vel: 0, lastY: 0, lastT: 0 };
  renderProducts();
  renderDetail();
  renderComments();
}

function renderFilters() {
  const host = document.getElementById("filters");
  host.replaceChildren();
  host.append(
    group("style", "Style", ["all", "stud", "hoop", "drop", "cuff", "chandelier"]),
    group("material", "Material", ["all", "gold", "silver", "rose", "pearl"]),
    group("size", "Size", ["all", "small", "medium", "large"]),
  );
}

function group(name, label, values) {
  const wrap = el("div", "filter-group");
  wrap.append(el("span", "filter-label", label));
  const row = el("div", "chip-row");
  for (const value of values) {
    const button = el("button", "chip", value === "all" ? "All" : titleCase(value));
    button.type = "button";
    button.dataset.group = name;
    button.dataset.value = value;
    button.setAttribute("aria-pressed", String(state.filter[name] === value));
    row.append(button);
  }
  wrap.append(row);
  return wrap;
}

function renderProducts() {
  const list = document.getElementById("product-list");
  const matches = filterProducts(state.products, state.filter);
  list.replaceChildren();
  if (!matches.length) {
    list.append(el("p", "empty", "No earrings match this search."));
    return;
  }
  for (const product of matches) {
    const card = el("button", "product-card");
    card.type = "button";
    card.dataset.id = product.id;
    card.setAttribute("aria-pressed", String(product.id === state.selectedId));
    card.append(iconFor(product));
    const copy = el("span", "product-copy");
    copy.append(el("span", "product-name", product.name), el("span", "product-meta", `${titleCase(product.style)} · ${titleCase(product.material)} · ${money(product.price)}`));
    card.append(copy);
    list.append(card);
  }
}

function renderDetail() {
  const host = document.getElementById("detail");
  const product = state.products.find((item) => item.id === state.selectedId);
  host.replaceChildren();
  if (!product) {
    host.append(el("p", "empty", "Choose an earring to preview it."));
    return;
  }
  host.append(el("h2", "detail-title", product.name));
  const meta = el("p", "detail-meta");
  meta.append(
    el("span", null, titleCase(product.style)),
    el("span", null, titleCase(product.material)),
    el("span", null, titleCase(product.size)),
    el("span", null, money(product.price)),
  );
  host.append(meta);
  host.append(el("p", "detail-copy", product.description));
  const facts = el("dl", "facts");
  addFact(facts, "SKU", product.sku || "—");
  addFact(facts, "Stock", product.stock > 0 ? `${product.stock} in stock` : "Out of stock");
  addFact(facts, "Radius", `${product.radiusMm} mm`);
  if (product.dropMm) addFact(facts, "Drop", `${product.dropMm} mm`);
  host.append(facts);
  host.append(el("p", "hint", "Scale assumes 63 mm between the outer corners of the eyes. Preview only — this page does not take payment."));
}

function renderComments() {
  const host = document.getElementById("comments");
  host.replaceChildren();
  const items = state.comments.filter((comment) => comment.productId === state.selectedId);
  if (!items.length) {
    host.append(el("p", "empty", "No comments on this piece yet."));
    return;
  }
  for (const comment of items) {
    const item = el("article", "comment");
    const head = el("div", "comment-head");
    head.append(el("strong", null, comment.author), el("time", null, relativeTime(comment.ts)));
    const remove = el("button", "text-button", "Remove");
    remove.type = "button";
    remove.dataset.removeComment = comment.id;
    head.append(remove);
    item.append(head, el("p", null, comment.text));
    host.append(item);
  }
}

function bindFit() {
  const fields = [
    ["fit-x", "x", 1],
    ["fit-y", "y", 1],
    ["fit-scale", "scale", 1],
    ["fit-rot", "rot", 1],
    ["cutoff", "minCutoff", 1],
    ["beta", "beta", 1],
    ["yaw", "mannequinYaw", 1],
    ["pitch", "mannequinPitch", 1],
  ];
  for (const [id, key, scale] of fields) {
    const input = document.getElementById(id);
    const output = document.getElementById(`${id}-out`);
    const apply = () => {
      const value = Number(input.value) * scale;
      if (key in state.fit) state.fit[key] = value;
      else state[key] = value;
      if (output) output.textContent = formatFit(id, input.value);
    };
    input.addEventListener("input", apply);
    apply();
  }
  document.getElementById("ears").addEventListener("change", (event) => {
    state.fit.ears = event.target.value;
  });
  document.getElementById("smoothing").addEventListener("change", (event) => {
    state.smoothing = event.target.checked;
    if (!state.smoothing) state.filters?.reset();
  });
  document.getElementById("anchors").addEventListener("change", (event) => {
    state.showAnchors = event.target.checked;
  });
  document.getElementById("mesh").addEventListener("change", (event) => {
    state.showMesh = event.target.checked;
  });
  document.getElementById("mirror").addEventListener("change", (event) => {
    state.mirror = event.target.checked;
    state.filters?.reset();
  });
  document.getElementById("noise").addEventListener("change", (event) => {
    state.demoNoise = event.target.checked;
  });
  document.getElementById("reset-fit").addEventListener("click", () => {
    state.fit = { x: 0, y: 0, scale: 1, rot: 0, ears: state.fit.ears };
    setValue("fit-x", 0);
    setValue("fit-y", 0);
    setValue("fit-scale", 1);
    setValue("fit-rot", 0);
  });
}

function bindAdmin() {
  const dialog = document.getElementById("admin");
  document.getElementById("admin-open").addEventListener("click", () => {
    document.getElementById("pin").value = "";
    document.getElementById("pin-msg").textContent = "";
    document.getElementById("admin-lock").hidden = false;
    document.getElementById("admin-panel").hidden = true;
    dialog.showModal();
  });
  document.getElementById("pin-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (document.getElementById("pin").value.trim().toLowerCase() !== "auricle") {
      document.getElementById("pin-msg").textContent = "That PIN does not match.";
      return;
    }
    document.getElementById("admin-lock").hidden = true;
    document.getElementById("admin-panel").hidden = false;
    fillProductForm(null);
    renderAdminList();
  });
  document.getElementById("product-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    const data = Object.fromEntries(new FormData(form).entries());
    const existingId = form.dataset.id || "";
    let imageDataUrl = "";
    const existing = state.products.find((product) => product.id === existingId);
    if (form.image.files[0]) imageDataUrl = await fileToDataUrl(form.image.files[0]);
    else if (existing && !form.clearImage.checked) imageDataUrl = existing.imageDataUrl || "";
    if (!data.name.trim()) {
      document.getElementById("form-msg").textContent = "A name is required.";
      return;
    }
    const product = normalizeProduct({ ...data, imageDataUrl }, existingId || undefined);
    if (existingId) {
      state.products = state.products.map((item) => (item.id === existingId ? product : item));
    } else {
      state.products.unshift(product);
    }
    persist();
    selectProduct(product.id);
    fillProductForm(null);
    renderAdminList();
    document.getElementById("form-msg").textContent = "Saved in this browser.";
  });
  document.getElementById("admin-list").addEventListener("click", (event) => {
    const edit = event.target.closest("[data-edit]");
    const remove = event.target.closest("[data-delete]");
    if (edit) {
      const product = state.products.find((item) => item.id === edit.dataset.edit);
      fillProductForm(product);
    }
    if (remove) {
      const id = remove.dataset.delete;
      state.products = state.products.filter((item) => item.id !== id);
      state.comments = state.comments.filter((comment) => comment.productId !== id);
      if (state.selectedId === id) state.selectedId = state.products[0]?.id || "";
      persist();
      renderAdminList();
      renderProducts();
      renderDetail();
      renderComments();
    }
  });
  document.getElementById("restore-catalog").addEventListener("click", async () => {
    const { cloneProducts } = await import("./catalog.js");
    const products = cloneProducts();
    const ids = new Set(products.map((product) => product.id));
    state.products = products;
    state.comments = state.comments.filter((comment) => ids.has(comment.productId));
    state.selectedId = products[0].id;
    persist();
    fillProductForm(null);
    renderAdminList();
    renderProducts();
    renderDetail();
    renderComments();
  });
  document.getElementById("new-product").addEventListener("click", () => fillProductForm(null));
}

function renderAdminList() {
  const host = document.getElementById("admin-list");
  host.replaceChildren();
  for (const product of state.products) {
    const row = el("div", "admin-row");
    row.append(el("span", null, `${product.name} · ${product.sku || "no SKU"} · stock ${product.stock}`));
    const actions = el("span", "row-actions");
    const edit = el("button", "text-button", "Edit");
    edit.type = "button";
    edit.dataset.edit = product.id;
    const remove = el("button", "text-button", "Delete");
    remove.type = "button";
    remove.dataset.delete = product.id;
    actions.append(edit, remove);
    row.append(actions);
    host.append(row);
  }
}

function fillProductForm(product) {
  const form = document.getElementById("product-form");
  form.dataset.id = product?.id || "";
  form.reset();
  const values = product || {
    name: "",
    sku: "",
    price: 100,
    stock: 1,
    style: "stud",
    material: "gold",
    metal: "gold",
    size: "medium",
    gem: "#e7eefc",
    radiusMm: 8,
    tubeMm: 1.2,
    dropMm: 0,
    description: "",
  };
  for (const [key, value] of Object.entries(values)) {
    if (form.elements[key] && key !== "imageDataUrl") form.elements[key].value = value;
  }
  document.getElementById("form-heading").textContent = product ? `Edit ${product.name}` : "New earring";
  document.getElementById("form-msg").textContent = "";
}

function addFact(list, label, value) {
  list.append(el("dt", null, label), el("dd", null, value));
}

function iconFor(product) {
  if (product.imageDataUrl) {
    const img = document.createElement("img");
    img.className = "product-icon";
    img.alt = "";
    img.src = product.imageDataUrl;
    return img;
  }
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 48 48");
  svg.setAttribute("class", "product-icon");
  svg.setAttribute("aria-hidden", "true");
  const color = METAL[product.metal] || METAL.gold;
  const gem = /^#[0-9a-fA-F]{6}$/.test(product.gem || "") ? product.gem : "#dbe7ff";
  if (product.style === "hoop") {
    svg.append(shape("ellipse", { cx: 24, cy: 27, rx: 10, ry: 13, fill: "none", stroke: color, "stroke-width": 3 }));
  } else if (product.style === "drop") {
    svg.append(
      shape("circle", { cx: 24, cy: 12, r: 3, fill: color }),
      shape("line", { x1: 24, y1: 15, x2: 24, y2: 30, stroke: color, "stroke-width": 1.5 }),
      shape("circle", { cx: 24, cy: 35, r: 6, fill: product.material === "pearl" ? "#f3ece4" : gem }),
    );
  } else if (product.style === "cuff") {
    svg.append(shape("path", { d: "M16 34c2-14 14-18 16-6", fill: "none", stroke: color, "stroke-width": 3, "stroke-linecap": "round" }));
  } else if (product.style === "chandelier") {
    svg.append(
      shape("circle", { cx: 24, cy: 10, r: 2.5, fill: color }),
      shape("line", { x1: 18, y1: 14, x2: 16, y2: 30, stroke: color, "stroke-width": 1.4 }),
      shape("line", { x1: 24, y1: 14, x2: 24, y2: 36, stroke: color, "stroke-width": 1.4 }),
      shape("line", { x1: 30, y1: 14, x2: 32, y2: 28, stroke: color, "stroke-width": 1.4 }),
    );
  } else if (product.shape === "bar") {
    svg.append(shape("rect", { x: 12, y: 22, width: 24, height: 4, rx: 2, fill: color }), shape("circle", { cx: 24, cy: 24, r: 3, fill: gem }));
  } else {
    svg.append(shape("circle", { cx: 24, cy: 24, r: 8, fill: product.metal === "pearl" ? "#f3ece4" : color }), shape("circle", { cx: 24, cy: 24, r: 3.5, fill: gem }));
  }
  return svg;
}

function shape(tag, attrs) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

function persist() {
  saveDb({ products: state.products, comments: state.comments });
}

function setValue(id, value) {
  const input = document.getElementById(id);
  input.value = value;
  input.dispatchEvent(new Event("input"));
}

function formatFit(id, value) {
  if (id === "fit-scale") return `${Number(value).toFixed(2)}×`;
  if (id === "fit-rot" || id === "yaw" || id === "pitch") return `${Number(value).toFixed(2)}`;
  if (id === "cutoff" || id === "beta") return Number(value).toFixed(2);
  return `${Number(value).toFixed(0)} px`;
}

function relativeTime(ts) {
  const minutes = Math.round((Date.now() - ts) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} d ago`;
}

function titleCase(value) {
  return String(value).replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const max = 480;
        const scale = Math.min(1, max / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.onerror = () => reject(new Error("Could not read that image."));
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}
