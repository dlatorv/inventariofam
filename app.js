(function () {
  "use strict";

  const STORAGE_KEY = "familyInventory.v1";

  const CATEGORIES = [
    { id: "fruta", label: "Fruta" },
    { id: "verdura", label: "Verdura" },
    { id: "lacteos_huevos", label: "Lácteos y huevos" },
    { id: "carne_pescado", label: "Carne y pescado" },
    { id: "congelados", label: "Congelados" },
    { id: "despensa", label: "Despensa / abarrotes" },
    { id: "limpieza", label: "Limpieza" },
    { id: "otros", label: "Otros" },
  ];

  // Default shelf life in days, used to suggest an expiration date by category
  // when the user doesn't provide one. null = no fixed expiration suggested.
  const DEFAULT_SHELF_LIFE = {
    fruta: 6,
    verdura: 5,
    lacteos_huevos: 21,
    carne_pescado: 3,
    congelados: 90,
    despensa: null,
    limpieza: null,
    otros: null,
  };

  const DEFAULT_SETTINGS = {
    soonThresholdDays: 3,
    shelfLife: { ...DEFAULT_SHELF_LIFE },
  };

  function loadState() {
    let raw;
    try {
      raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch (e) {
      raw = null;
    }
    return {
      inventory: raw && Array.isArray(raw.inventory) ? raw.inventory : [],
      shoppingList: raw && Array.isArray(raw.shoppingList) ? raw.shoppingList : [],
      settings: raw && raw.settings
        ? { ...DEFAULT_SETTINGS, ...raw.settings, shelfLife: { ...DEFAULT_SHELF_LIFE, ...(raw.settings.shelfLife || {}) } }
        : { ...DEFAULT_SETTINGS, shelfLife: { ...DEFAULT_SHELF_LIFE } },
    };
  }

  let state = loadState();

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function todayISO() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return isoFromDate(d);
  }

  function isoFromDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function addDaysISO(iso, days) {
    const d = new Date(iso + "T00:00:00");
    d.setDate(d.getDate() + days);
    return isoFromDate(d);
  }

  function daysUntil(iso) {
    const today = new Date(todayISO() + "T00:00:00");
    const target = new Date(iso + "T00:00:00");
    return Math.round((target - today) / 86400000);
  }

  function categoryLabel(id) {
    const c = CATEGORIES.find((c) => c.id === id);
    return c ? c.label : id;
  }

  function computeStatus(item) {
    if (!item.expirationDate) return { key: "none", label: "Sin fecha" };
    const d = daysUntil(item.expirationDate);
    if (d < 0) return { key: "expired", label: `Vencido hace ${Math.abs(d)} día(s)` };
    if (d <= state.settings.soonThresholdDays) {
      return { key: "soon", label: d === 0 ? "Vence hoy" : `Vence en ${d} día(s)` };
    }
    return { key: "fresh", label: `Vence en ${d} día(s)` };
  }

  function suggestExpiration(categoryId, fromDateISO) {
    const days = state.settings.shelfLife[categoryId];
    if (days == null) return "";
    return addDaysISO(fromDateISO || todayISO(), days);
  }

  // ---------- DOM refs ----------
  const $ = (id) => document.getElementById(id);

  function fillSelect(select, options, withEmpty) {
    select.innerHTML = "";
    if (withEmpty) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = withEmpty;
      select.appendChild(opt);
    }
    options.forEach((o) => {
      const opt = document.createElement("option");
      opt.value = o.id;
      opt.textContent = o.label;
      select.appendChild(opt);
    });
  }

  // ---------- Tabs ----------
  function initTabs() {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
        document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
        btn.classList.add("active");
        $("tab-" + btn.dataset.tab).classList.add("active");
        if (btn.dataset.tab === "ajustes") renderSettings();
      });
    });
  }

  // ---------- Render: Resumen ----------
  function renderResumen() {
    const expired = state.inventory.filter((i) => computeStatus(i).key === "expired");
    const soon = state.inventory.filter((i) => computeStatus(i).key === "soon");

    $("statTotal").textContent = state.inventory.length;
    $("statSoon").textContent = soon.length;
    $("statExpired").textContent = expired.length;
    $("statShopping").textContent = state.shoppingList.filter((s) => !s.checked).length;

    const banner = $("alertBanner");
    if (expired.length > 0) {
      banner.hidden = false;
      banner.textContent = `⚠️ Tienes ${expired.length} ítem(s) vencido(s). Revisa si aún se pueden usar.`;
    } else if (soon.length > 0) {
      banner.hidden = false;
      banner.textContent = `⏳ Tienes ${soon.length} ítem(s) por vencer pronto.`;
    } else {
      banner.hidden = true;
    }

    const list = expired.concat(soon).sort((a, b) => {
      return (a.expirationDate || "").localeCompare(b.expirationDate || "");
    });
    const container = $("attentionList");
    container.innerHTML = "";
    list.forEach((item) => container.appendChild(buildInventoryCard(item)));
    $("attentionEmpty").hidden = list.length > 0;
  }

  // ---------- Render: Inventario ----------
  function buildInventoryCard(item) {
    const status = computeStatus(item);
    const outOfStock = (parseFloat(item.quantity) || 0) <= 0;
    const card = document.createElement("div");
    card.className = `item-card status-${status.key}`;

    const main = document.createElement("div");
    main.className = "item-main";
    main.innerHTML = `
      <div class="item-name">${escapeHtml(item.name)}</div>
      <div class="item-meta">${categoryLabel(item.category)} · ${item.quantity || ""} ${escapeHtml(item.unit || "")}</div>
    `;
    const badge = document.createElement("span");
    badge.className = `badge status-${status.key}`;
    badge.textContent = status.label;
    main.appendChild(badge);
    if (outOfStock) {
      const outBadge = document.createElement("span");
      outBadge.className = "badge outofstock";
      outBadge.textContent = "Agotado";
      main.appendChild(outBadge);
    }
    card.appendChild(main);

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "btn small";
    editBtn.textContent = "Editar";
    editBtn.addEventListener("click", () => openItemModal(item));
    actions.appendChild(editBtn);

    if (status.key === "expired" || status.key === "soon" || outOfStock) {
      const buyBtn = document.createElement("button");
      buyBtn.className = "btn small";
      buyBtn.textContent = "A compras";
      buyBtn.title = "Agregar a la lista de compras";
      buyBtn.addEventListener("click", () => {
        addToShoppingList(item.name, item.category, item.unit);
        renderAll();
      });
      actions.appendChild(buyBtn);
    }

    const delBtn = document.createElement("button");
    delBtn.className = "btn small danger-outline";
    delBtn.textContent = "Eliminar";
    delBtn.addEventListener("click", () => {
      if (confirm(`¿Eliminar "${item.name}" del inventario?`)) {
        state.inventory = state.inventory.filter((i) => i.id !== item.id);
        saveState();
        renderAll();
      }
    });
    actions.appendChild(delBtn);

    card.appendChild(actions);
    return card;
  }

  function renderInventario() {
    const search = $("invSearch").value.trim().toLowerCase();
    const catFilter = $("invFilterCategory").value;

    let items = state.inventory.slice();
    if (search) items = items.filter((i) => i.name.toLowerCase().includes(search));
    if (catFilter) items = items.filter((i) => i.category === catFilter);

    items.sort((a, b) => {
      const sa = computeStatus(a).key, sb = computeStatus(b).key;
      const order = { expired: 0, soon: 1, fresh: 2, none: 3 };
      if (order[sa] !== order[sb]) return order[sa] - order[sb];
      return a.name.localeCompare(b.name);
    });

    const container = $("inventoryList");
    container.innerHTML = "";
    items.forEach((item) => container.appendChild(buildInventoryCard(item)));
    $("inventoryEmpty").hidden = state.inventory.length > 0;
  }

  // ---------- Render: Lista de compras ----------
  function buildShoppingCard(entry) {
    const card = document.createElement("div");
    card.className = "item-card" + (entry.checked ? " checked" : "");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "item-checkbox";
    checkbox.checked = entry.checked;
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        openBoughtModal(entry);
      } else {
        entry.checked = false;
        saveState();
        renderAll();
      }
    });
    card.appendChild(checkbox);

    const main = document.createElement("div");
    main.className = "item-main";
    main.innerHTML = `
      <div class="item-name">${escapeHtml(entry.name)}</div>
      <div class="item-meta">${entry.category ? categoryLabel(entry.category) : "Sin categoría"}${entry.quantity ? " · " + entry.quantity + " " + escapeHtml(entry.unit || "") : ""}</div>
    `;
    card.appendChild(main);

    const actions = document.createElement("div");
    actions.className = "item-actions";
    const delBtn = document.createElement("button");
    delBtn.className = "btn small danger-outline";
    delBtn.textContent = "Quitar";
    delBtn.addEventListener("click", () => {
      state.shoppingList = state.shoppingList.filter((s) => s.id !== entry.id);
      saveState();
      renderAll();
    });
    actions.appendChild(delBtn);
    card.appendChild(actions);

    return card;
  }

  function renderCompras() {
    const container = $("shoppingList");
    container.innerHTML = "";
    const sorted = state.shoppingList.slice().sort((a, b) => (a.checked === b.checked ? 0 : a.checked ? 1 : -1));
    sorted.forEach((entry) => container.appendChild(buildShoppingCard(entry)));
    $("shoppingEmpty").hidden = state.shoppingList.length > 0;
  }

  function addToShoppingList(name, category, unit) {
    const exists = state.shoppingList.some(
      (s) => !s.checked && s.name.toLowerCase() === name.toLowerCase()
    );
    if (exists) return;
    state.shoppingList.push({
      id: uid(),
      name,
      category: category || "",
      quantity: "",
      unit: unit || "",
      checked: false,
    });
    saveState();
  }

  // ---------- Render: Ajustes ----------
  function renderSettings() {
    $("cfgThreshold").value = state.settings.soonThresholdDays;
    const table = $("shelfLifeTable");
    table.innerHTML = "";
    CATEGORIES.forEach((cat) => {
      const row = document.createElement("div");
      row.className = "shelf-row";
      const val = state.settings.shelfLife[cat.id];
      row.innerHTML = `
        <span>${cat.label}</span>
        <input type="number" min="0" data-cat="${cat.id}" value="${val == null ? "" : val}" placeholder="sin límite">
      `;
      table.appendChild(row);
    });
  }

  // ---------- Item modal (agregar/editar inventario) ----------
  function openItemModal(item) {
    $("itemModalTitle").textContent = item ? "Editar ítem" : "Agregar ítem";
    $("itemId").value = item ? item.id : "";
    $("itemName").value = item ? item.name : "";
    $("itemCategory").value = item ? item.category : CATEGORIES[0].id;
    $("itemQuantity").value = item ? item.quantity : 1;
    $("itemUnit").value = item ? item.unit || "" : "";
    $("itemPurchaseDate").value = item ? item.purchaseDate || "" : todayISO();
    $("itemExpirationDate").value = item ? item.expirationDate || "" : "";
    $("itemNotes").value = item ? item.notes || "" : "";
    updateItemSuggestHint();
    $("itemModalOverlay").hidden = false;
  }

  function closeItemModal() {
    $("itemModalOverlay").hidden = true;
  }

  function updateItemSuggestHint() {
    if ($("itemExpirationDate").value) {
      $("itemSuggestHint").textContent = "";
      return;
    }
    const suggestion = suggestExpiration($("itemCategory").value, $("itemPurchaseDate").value);
    $("itemSuggestHint").textContent = suggestion
      ? `Si no indicas una fecha, se sugerirá automáticamente: ${suggestion}`
      : "Esta categoría no tiene vida útil por defecto configurada.";
  }

  function initItemModal() {
    $("btnAddInventory").addEventListener("click", () => openItemModal(null));
    $("btnCancelItem").addEventListener("click", closeItemModal);
    $("itemModalOverlay").addEventListener("click", (e) => {
      if (e.target.id === "itemModalOverlay") closeItemModal();
    });
    $("itemCategory").addEventListener("change", updateItemSuggestHint);
    $("itemPurchaseDate").addEventListener("change", updateItemSuggestHint);
    $("itemExpirationDate").addEventListener("input", updateItemSuggestHint);

    $("itemForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const id = $("itemId").value || uid();
      const category = $("itemCategory").value;
      const purchaseDate = $("itemPurchaseDate").value || todayISO();
      let expirationDate = $("itemExpirationDate").value;
      if (!expirationDate) expirationDate = suggestExpiration(category, purchaseDate);

      const item = {
        id,
        name: $("itemName").value.trim(),
        category,
        quantity: parseFloat($("itemQuantity").value) || 0,
        unit: $("itemUnit").value.trim(),
        purchaseDate,
        expirationDate: expirationDate || null,
        notes: $("itemNotes").value.trim(),
      };
      if (!item.name) return;

      const existingIndex = state.inventory.findIndex((i) => i.id === id);
      if (existingIndex >= 0) {
        state.inventory[existingIndex] = item;
      } else {
        state.inventory.push(item);
      }
      saveState();
      closeItemModal();
      renderAll();
    });
  }

  // ---------- Bought modal (mover de compras a inventario) ----------
  let boughtEntryId = null;

  function openBoughtModal(entry) {
    boughtEntryId = entry.id;
    $("boughtId").value = entry.id;
    $("boughtName").textContent = entry.name;
    $("boughtCategory").value = entry.category || CATEGORIES[0].id;
    $("boughtQuantity").value = entry.quantity || 1;
    $("boughtUnit").value = entry.unit || "";
    const suggestion = suggestExpiration($("boughtCategory").value, todayISO());
    $("boughtExpirationDate").value = suggestion;
    updateBoughtSuggestHint();
    $("boughtModalOverlay").hidden = false;
  }

  function closeBoughtModal(revertCheckbox) {
    $("boughtModalOverlay").hidden = true;
    if (revertCheckbox) renderCompras();
    boughtEntryId = null;
  }

  function updateBoughtSuggestHint() {
    if ($("boughtExpirationDate").value) {
      $("boughtSuggestHint").textContent = "";
      return;
    }
    const suggestion = suggestExpiration($("boughtCategory").value, todayISO());
    $("boughtSuggestHint").textContent = suggestion
      ? `Se sugiere: ${suggestion}`
      : "Sin vida útil por defecto para esta categoría.";
  }

  function initBoughtModal() {
    $("btnCancelBought").addEventListener("click", () => closeBoughtModal(true));
    $("boughtModalOverlay").addEventListener("click", (e) => {
      if (e.target.id === "boughtModalOverlay") closeBoughtModal(true);
    });
    $("boughtCategory").addEventListener("change", updateBoughtSuggestHint);
    $("boughtExpirationDate").addEventListener("input", updateBoughtSuggestHint);

    $("boughtForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const entry = state.shoppingList.find((s) => s.id === boughtEntryId);
      if (!entry) return;

      const newItem = {
        id: uid(),
        name: entry.name,
        category: $("boughtCategory").value,
        quantity: parseFloat($("boughtQuantity").value) || 0,
        unit: $("boughtUnit").value.trim(),
        purchaseDate: todayISO(),
        expirationDate: $("boughtExpirationDate").value || null,
        notes: "",
      };
      state.inventory.push(newItem);
      state.shoppingList = state.shoppingList.filter((s) => s.id !== boughtEntryId);
      saveState();
      $("boughtModalOverlay").hidden = true;
      boughtEntryId = null;
      renderAll();
    });
  }

  // ---------- Wiring: inventario toolbar ----------
  function initInventoryToolbar() {
    $("invSearch").addEventListener("input", renderInventario);
    $("invFilterCategory").addEventListener("change", renderInventario);
  }

  // ---------- Wiring: compras quick add ----------
  function initShoppingToolbar() {
    function quickAdd() {
      const name = $("shopQuickAdd").value.trim();
      if (!name) return;
      addToShoppingList(name, "", "");
      $("shopQuickAdd").value = "";
      renderAll();
    }
    $("btnQuickAddShop").addEventListener("click", quickAdd);
    $("shopQuickAdd").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        quickAdd();
      }
    });
  }

  // ---------- Wiring: ajustes ----------
  function initSettings() {
    $("cfgThreshold").addEventListener("change", () => {
      const v = parseInt($("cfgThreshold").value, 10);
      state.settings.soonThresholdDays = isNaN(v) ? 3 : v;
      saveState();
      renderAll();
    });

    $("shelfLifeTable").addEventListener("change", (e) => {
      const input = e.target.closest("input[data-cat]");
      if (!input) return;
      const cat = input.dataset.cat;
      const v = input.value === "" ? null : parseInt(input.value, 10);
      state.settings.shelfLife[cat] = isNaN(v) ? null : v;
      saveState();
    });

    $("btnExport").addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `inventario-familiar-${todayISO()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    $("btnReset").addEventListener("click", () => {
      if (confirm("Esto borrará todo tu inventario y lista de compras en este navegador. ¿Continuar?")) {
        state = { inventory: [], shoppingList: [], settings: { ...DEFAULT_SETTINGS, shelfLife: { ...DEFAULT_SHELF_LIFE } } };
        saveState();
        renderAll();
        renderSettings();
      }
    });
  }

  // ---------- Lock screen (soft privacy gate, not real security) ----------
  const LOCK_STORAGE_KEY = "familyInventory.unlocked";
  const LOCK_PIN_HASH = "2ee62f16ca41fe7879853975d5fcb4cb858f6edb5fd0355cfb7948d997e6b6a9"; // sha256("3312")

  async function sha256Hex(text) {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function setLocked(locked) {
    document.body.classList.toggle("locked", locked);
    $("lockOverlay").hidden = !locked;
    if (locked) {
      localStorage.removeItem(LOCK_STORAGE_KEY);
      $("lockPin").value = "";
      $("lockError").hidden = true;
      $("lockPin").focus();
    } else {
      localStorage.setItem(LOCK_STORAGE_KEY, "1");
    }
  }

  function initLock() {
    setLocked(localStorage.getItem(LOCK_STORAGE_KEY) !== "1");

    $("lockForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const hash = await sha256Hex($("lockPin").value.trim());
      if (hash === LOCK_PIN_HASH) {
        setLocked(false);
      } else {
        $("lockError").hidden = false;
      }
    });

    $("btnLockNow").addEventListener("click", () => setLocked(true));
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function renderAll() {
    renderResumen();
    renderInventario();
    renderCompras();
  }

  function init() {
    initLock();

    fillSelect($("invFilterCategory"), CATEGORIES, "Todas las categorías");
    fillSelect($("itemCategory"), CATEGORIES, null);
    fillSelect($("boughtCategory"), CATEGORIES, null);

    initTabs();
    initItemModal();
    initBoughtModal();
    initInventoryToolbar();
    initShoppingToolbar();
    initSettings();

    renderAll();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
