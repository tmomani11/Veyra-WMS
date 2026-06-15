function renderInventory() {
  return `
    <section class="split">
      <div class="panel">
        <div class="panel-header">
          <div class="section-title"><h2>Inventory Items</h2><span>Foreign key target for order_items.item_id</span></div>
          <div class="toolbar">
            <input class="search" id="inventorySearch" placeholder="Search SKU, name, barcode&hellip;" aria-label="Search inventory">
            ${can("inventory:write") ? `<button class="secondary-btn" id="exportInventoryCSV" title="Export to CSV" aria-label="Export inventory to CSV">${icon("export")} Export CSV</button>` : ""}
          </div>
        </div>
        <div class="table-wrap">
          <table aria-label="Inventory items">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Name</th>
                <th>Qty / Reorder</th>
                <th>Location</th>
                <th>Velocity</th>
                <th>Supplier</th>
                <th>Barcode</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="inventoryRows">${inventoryRows("")}</tbody>
          </table>
        </div>
      </div>
      <div class="panel">
        <div class="panel-header"><div class="section-title"><h2>Add / Edit Item</h2><span>SKU auto-generates by category</span></div></div>
        ${renderInventoryForm()}
      </div>
    </section>
    ${renderConfirmModal("deleteItemModal", "Delete Item", "This item will be permanently removed from inventory. This action cannot be undone.", "Delete", true)}`;
}

function inventoryRows(query) {
  const q = query.toLowerCase();
  const filtered = state.inventory.filter((item) =>
    [item.sku, item.name, item.barcode, item.bin, item.supplier || ""].join(" ").toLowerCase().includes(q)
  );
  if (!filtered.length) {
    return `<tr><td colspan="9" class="empty-state">No items match your search.</td></tr>`;
  }
  return filtered.map((item) => `
    <tr>
      <td><strong>${item.sku}</strong></td>
      <td>${item.name}<br><span class="badge">${item.category}</span></td>
      <td>${item.qty} <small>/ ${item.reorder}</small></td>
      <td>${item.bin}<br><small class="coord">(${item.x}, ${item.y})</small></td>
      <td><span class="badge velocity-${(item.velocity || "C").toLowerCase()}">${item.velocity || "C"}</span></td>
      <td>${item.supplier || "—"}</td>
      <td class="mono">${item.barcode}</td>
      <td>${lowStockBadge(item)}</td>
      <td class="toolbar">
        ${can("inventory:write") ? `
          <button class="icon-btn" title="Edit ${item.sku}" aria-label="Edit ${item.name}" data-edit-item="${item.id}">${icon("edit")}</button>
          <button class="icon-btn danger-icon" title="Delete ${item.sku}" aria-label="Delete ${item.name}" data-delete-item="${item.id}">${icon("del")}</button>
        ` : ""}
      </td>
    </tr>`).join("");
}

function renderInventoryForm(item = {}) {
  const disabled = can("inventory:write") ? "" : "disabled";
  return `
    <form id="inventoryForm" class="form-grid" novalidate>
      <input type="hidden" id="itemId" value="${item.id || ""}">
      <div class="field wide"><label for="itemName">Name <span class="req">*</span></label><input id="itemName" value="${item.name || ""}" placeholder="e.g. USB-C Scanner Cradle" ${disabled} required></div>
      <div class="field">
        <label for="itemCategory">Category</label>
        <select id="itemCategory" ${disabled}>
          ${["Electronics", "Packing", "Safety", "Hardware"].map((c) => `<option ${item.category === c ? "selected" : ""}>${c}</option>`)}
        </select>
      </div>
      <div class="field">
        <label for="itemVelocity">Velocity</label>
        <select id="itemVelocity" ${disabled}>
          ${["A", "B", "C"].map((v) => `<option value="${v}" ${(item.velocity || "B") === v ? "selected" : ""}>${v} – ${v === "A" ? "Fast mover" : v === "B" ? "Regular" : "Slow mover"}</option>`)}
        </select>
      </div>
      <div class="field"><label for="itemSupplier">Supplier</label><input id="itemSupplier" value="${item.supplier || ""}" placeholder="e.g. ZebraTech" ${disabled}></div>
      <div class="field"><label for="itemQty">Quantity <span class="req">*</span></label><input id="itemQty" type="number" min="0" value="${item.qty ?? 0}" ${disabled} required></div>
      <div class="field"><label for="itemReorder">Reorder threshold</label><input id="itemReorder" type="number" min="0" value="${item.reorder ?? 10}" ${disabled}></div>
      <div class="field"><label for="itemAisle">Aisle</label><input id="itemAisle" value="${item.aisle || "A"}" maxlength="2" ${disabled}></div>
      <div class="field"><label for="itemBin">Bin</label><input id="itemBin" value="${item.bin || ""}" placeholder="A-01-01" ${disabled}></div>
      <div class="field"><label for="itemX">X coordinate</label><input id="itemX" type="number" min="0" max="11" value="${item.x ?? 1}" ${disabled}></div>
      <div class="field"><label for="itemY">Y coordinate</label><input id="itemY" type="number" min="0" max="7" value="${item.y ?? 1}" ${disabled}></div>
      <div class="field wide"><label for="itemBarcode">Barcode</label><input id="itemBarcode" value="${item.barcode || nextBarcode()}" ${disabled}></div>
    </form>
    <div class="form-actions">
      <button class="primary-btn" id="saveInventory" ${disabled}>${icon("save")} Save item</button>
      <button class="secondary-btn" id="clearInventory" ${disabled}>Clear form</button>
    </div>`;
}

function nextSku(category) {
  const prefix = { Electronics: "EL", Packing: "PK", Safety: "SF", Hardware: "HW", Warehouse: "WH" }[category] || "WH";
  const next = Math.max(0, ...state.inventory.map((item) => Number(item.sku.split("-")[1]))) + 1;
  return `${prefix}-${String(next).padStart(4, "0")}`;
}

function nextBarcode() {
  return String(88010010000 + state.inventory.length + 1);
}

function suggestedBin() {
  const next = state.inventory.length + state.receivingQueue.length + 1;
  const aisle = String.fromCharCode(65 + (next % 6));
  return `${aisle}-${String((next % 9) + 1).padStart(2, "0")}-${String((next % 7) + 1).padStart(2, "0")}`;
}

function coordsFromBin(bin) {
  const parts = bin.split("-");
  const x = Math.max(1, Math.min(11, Number(parts[1]) || 1));
  const y = Math.max(1, Math.min(7, Number(parts[2]) || 1));
  return { x, y };
}
