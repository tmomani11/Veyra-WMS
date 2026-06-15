function bindShell() {
  // Navigation
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeView = button.dataset.view;
      saveState();
      app();
      // Move focus to main content area for accessibility
      document.getElementById("mainContent")?.focus();
    });
  });

  // Logout
  document.getElementById("logout").addEventListener("click", () => {
    state.session = null;
    saveState();
    app();
  });

  // Dark mode toggle
  const darkToggle = document.getElementById("darkModeToggle");
  if (darkToggle) {
    darkToggle.addEventListener("click", () => {
      state.darkMode = !state.darkMode;
      saveState();
      app();
    });
  }

  // Global Escape key handler for modals
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal-overlay.visible").forEach((el) => el.classList.remove("visible"));
    }
  }, { once: true });

  // Dispatch per-view binders
  if (state.activeView === "inventory") bindInventory();
  if (state.activeView === "receiving") bindReceiving();
  if (state.activeView === "orders") bindOrders();
  if (state.activeView === "map") bindMap();
  if (state.activeView === "manager") bindManagerConsole();
  if (state.activeView === "owner") bindOwnerCommand();
}

// ─── Receiving ────────────────────────────────────────────────────────────────
function bindReceiving() {
  const scannerInput = document.getElementById("scannerInput");
  if (scannerInput) scannerInput.focus();

  document.querySelectorAll("[data-scan-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.scannerMode = button.dataset.scanMode;
      saveState();
      app();
    });
  });

  // Queue filter buttons
  document.querySelectorAll("[data-queue-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.receivingQueueFilter = button.dataset.queueFilter;
      saveState();
      // Only re-render the queue list, not the whole app
      const queueList = document.getElementById("receivingQueueList");
      if (queueList) {
        const filter = state.receivingQueueFilter;
        const filteredQueue = state.receivingQueue.filter((item) => {
          if (filter === "ready") return item.status === "ready to putaway";
          if (filter === "hold") return item.status === "quality hold";
          return true;
        });
        queueList.innerHTML = filteredQueue.length
          ? filteredQueue.map((item) => `
              <article class="queue-card">
                <div>
                  <strong>${item.sku} — ${item.name}</strong>
                  <span>${item.qty} units &bull; Bin: ${item.bin}</span>
                  <span class="mono">${item.barcode}</span>
                </div>
                <div class="queue-card-footer">
                  <span class="badge ${item.status === "quality hold" ? "danger" : "good"}">${item.status}</span>
                  <small>${new Date(item.scannedAt).toLocaleString()}</small>
                </div>
              </article>`).join("")
          : `<p class="empty-state">No items match the selected filter.</p>`;
        // Update active filter button styles
        document.querySelectorAll("[data-queue-filter]").forEach((btn) => {
          btn.classList.toggle("active", btn.dataset.queueFilter === filter);
          btn.setAttribute("aria-pressed", btn.dataset.queueFilter === filter);
        });
      }
    });
  });

  if (scannerInput) {
    scannerInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      parseScan(scannerInput.value.trim());
    });
  }

  const commitBtn = document.getElementById("commitScan");
  const holdBtn = document.getElementById("qualityHold");
  if (commitBtn) commitBtn.addEventListener("click", () => {
    if (state.scannerMode === "audit") commitAuditScan();
    else commitScan("ready to putaway");
  });
  if (holdBtn) holdBtn.addEventListener("click", () => commitScan("quality hold"));
}

function parseScan(value) {
  if (!value) return toast("Scan value is empty");
  const existing = state.inventory.find(
    (item) => item.barcode === value || item.sku.toLowerCase() === value.toLowerCase()
  );
  const resultEl = document.getElementById("scanResult");
  document.getElementById("scanBarcode").value = value;

  if (existing) {
    state.scannerMode = state.scannerMode === "audit" ? "audit" : "stock";
    document.getElementById("scanSku").value = existing.sku;
    document.getElementById("scanName").value = existing.name;
    document.getElementById("scanCategory").value = existing.category;
    document.getElementById("scanSupplier").value = existing.supplier || "";
    document.getElementById("scanQty").value = state.scannerMode === "audit" ? existing.qty : 1;
    document.getElementById("scanReorder").value = existing.reorder;
    document.getElementById("scanBin").value = existing.bin;
    document.getElementById("scanVelocity").value = existing.velocity || "B";
    if (resultEl) resultEl.textContent = `Matched ${existing.sku} — ${existing.name}. ${state.scannerMode === "audit" ? "Verify counted quantity." : "Stock-in mode is ready."}`;
    return;
  }

  const category = document.getElementById("scanCategory").value;
  document.getElementById("scanSku").value = nextSku(category);
  document.getElementById("scanName").value = `Scanned item ${value.slice(-5)}`;
  document.getElementById("scanBin").value = suggestedBin();
  if (resultEl) resultEl.textContent = "New barcode detected. Complete details and commit scan.";
}

function commitScan(status) {
  const barcode = document.getElementById("scanBarcode").value.trim();
  const sku = document.getElementById("scanSku").value.trim();
  const name = document.getElementById("scanName").value.trim();
  const category = document.getElementById("scanCategory").value;
  const supplier = document.getElementById("scanSupplier").value.trim();
  const qty = Number(document.getElementById("scanQty").value);
  const reorder = Number(document.getElementById("scanReorder").value);
  const bin = document.getElementById("scanBin").value.trim() || suggestedBin();
  const velocity = document.getElementById("scanVelocity").value;

  if (!barcode || !sku || !name || qty < 1) {
    return toast("Scan requires barcode, SKU, name, and quantity ≥ 1");
  }

  const existing = state.inventory.find((item) => item.barcode === barcode || item.sku === sku);
  let itemId;
  if (existing && status !== "quality hold") {
    existing.qty += qty;
    existing.reorder = reorder;
    existing.supplier = supplier;
    existing.velocity = velocity;
    itemId = existing.id;
  } else if (!existing && status !== "quality hold") {
    const coords = coordsFromBin(bin);
    const item = {
      id: Math.max(0, ...state.inventory.map((e) => e.id)) + 1,
      sku, name, category, qty, reorder,
      aisle: bin[0] || "W",
      bin, x: coords.x, y: coords.y,
      barcode, velocity, supplier
    };
    itemId = item.id;
    state.inventory.push(item);
    state.heat[`${coords.x},${coords.y}`] = (state.heat[`${coords.x},${coords.y}`] || 0) + qty;
  }

  state.receivingQueue.unshift({
    id: Math.max(0, ...state.receivingQueue.map((e) => e.id)) + 1,
    barcode, sku, name, qty, bin, status,
    scannedAt: new Date().toISOString()
  });

  if (itemId) {
    state.transactions.push({
      id: nextTransactionId(),
      type: "scanner_receive",
      orderId: null, itemId, qty,
      createdAt: new Date().toISOString()
    });
  }
  saveState();
  toast(status === "quality hold" ? "Scan staged for quality hold" : "Scan committed to inventory");
  app();
}

// Cycle count audit mode — adjusts qty to the counted value and logs a cycle_count transaction
function commitAuditScan() {
  const barcode = document.getElementById("scanBarcode").value.trim();
  const sku = document.getElementById("scanSku").value.trim();
  const countedQty = Number(document.getElementById("scanQty").value);
  if (!barcode && !sku) return toast("Enter barcode or SKU to audit");
  if (isNaN(countedQty) || countedQty < 0) return toast("Counted quantity must be a non-negative number");

  const existing = state.inventory.find(
    (item) => item.barcode === barcode || item.sku.toLowerCase() === sku.toLowerCase()
  );
  if (!existing) return toast("Item not found in inventory — use New SKU mode to add it");

  const delta = countedQty - existing.qty;
  existing.qty = countedQty;
  state.transactions.push({
    id: nextTransactionId(),
    type: "cycle_count",
    orderId: null,
    itemId: existing.id,
    qty: delta,
    createdAt: new Date().toISOString()
  });
  saveState();
  toast(`Cycle count saved for ${existing.sku}: ${delta >= 0 ? "+" : ""}${delta} units`);
  app();
}

// ─── Inventory ────────────────────────────────────────────────────────────────
function bindInventory() {
  const search = document.getElementById("inventorySearch");
  if (search) {
    search.addEventListener("input", () => {
      const rows = document.getElementById("inventoryRows");
      if (rows) rows.innerHTML = inventoryRows(search.value);
      bindInventoryRowButtons();
    });
  }

  const saveBtn = document.getElementById("saveInventory");
  if (saveBtn) saveBtn.addEventListener("click", saveInventoryItem);

  const clearBtn = document.getElementById("clearInventory");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      const panel = document.querySelector(".panel:last-child");
      if (panel) {
        panel.innerHTML = `
          <div class="panel-header"><div class="section-title"><h2>Add / Edit Item</h2><span>SKU auto-generates by category</span></div></div>
          ${renderInventoryForm()}`;
        bindInventory();
      }
    });
  }

  const exportBtn = document.getElementById("exportInventoryCSV");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      exportCSV(
        `veyra-inventory-${new Date().toISOString().slice(0, 10)}.csv`,
        ["SKU", "Name", "Category", "Qty", "Reorder", "Aisle", "Bin", "X", "Y", "Barcode", "Velocity", "Supplier"],
        state.inventory.map((i) => [i.sku, i.name, i.category, i.qty, i.reorder, i.aisle, i.bin, i.x, i.y, i.barcode, i.velocity || "", i.supplier || ""])
      );
      toast("Inventory exported to CSV");
    });
  }

  bindInventoryRowButtons();

  // Delete confirmation modal
  bindModalCancel("deleteItemModal");
}

function bindInventoryRowButtons() {
  document.querySelectorAll("[data-edit-item]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = state.inventory.find((entry) => entry.id === Number(button.dataset.editItem));
      const panel = document.querySelector(".panel:last-child");
      if (panel) {
        panel.innerHTML = `
          <div class="panel-header"><div class="section-title"><h2>Add / Edit Item</h2><span>Editing ${item.sku}</span></div></div>
          ${renderInventoryForm(item)}`;
        bindInventory();
        panel.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  let pendingDeleteId = null;
  document.querySelectorAll("[data-delete-item]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = Number(button.dataset.deleteItem);
      if (state.orders.some((order) => order.items.some((line) => line.itemId === id))) {
        return toast("Cannot delete: item is referenced by existing orders");
      }
      pendingDeleteId = id;
      showModal("deleteItemModal");
      const confirmBtn = document.getElementById("deleteItemModalConfirm");
      if (confirmBtn) {
        confirmBtn.onclick = () => {
          state.inventory = state.inventory.filter((item) => item.id !== pendingDeleteId);
          saveState();
          hideModal("deleteItemModal");
          toast("Item deleted");
          app();
        };
      }
    });
  });
}

function saveInventoryItem() {
  const id = Number(document.getElementById("itemId").value);
  const category = document.getElementById("itemCategory").value;
  const name = document.getElementById("itemName").value.trim();
  if (!name) return toast("Item name is required");

  const payload = {
    id: id || Math.max(0, ...state.inventory.map((item) => item.id)) + 1,
    sku: id ? state.inventory.find((item) => item.id === id).sku : nextSku(category),
    name, category,
    qty: Number(document.getElementById("itemQty").value),
    reorder: Number(document.getElementById("itemReorder").value),
    aisle: document.getElementById("itemAisle").value.trim().toUpperCase(),
    bin: document.getElementById("itemBin").value.trim() || `${document.getElementById("itemAisle").value.trim().toUpperCase()}-01-01`,
    x: Number(document.getElementById("itemX").value),
    y: Number(document.getElementById("itemY").value),
    barcode: document.getElementById("itemBarcode").value.trim(),
    velocity: document.getElementById("itemVelocity").value,
    supplier: document.getElementById("itemSupplier").value.trim()
  };

  state.inventory = id
    ? state.inventory.map((item) => item.id === id ? payload : item)
    : [...state.inventory, payload];
  saveState();
  toast(id ? `${payload.sku} updated` : `${payload.sku} added to inventory`);
  app();
}

// ─── Orders ───────────────────────────────────────────────────────────────────
function bindOrders() {
  document.querySelectorAll("[data-select-order]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedOrderId = Number(button.dataset.selectOrder);
      state.activeView = "map";
      saveState();
      app();
    });
  });

  document.querySelectorAll("[data-status-order]").forEach((select) => {
    select.addEventListener("change", () => {
      const order = state.orders.find((entry) => entry.id === Number(select.dataset.statusOrder));
      if (order) { order.status = select.value; saveState(); app(); }
    });
  });

  const exportBtn = document.getElementById("exportOrdersCSV");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      exportCSV(
        `veyra-orders-${new Date().toISOString().slice(0, 10)}.csv`,
        ["Order ID", "Customer", "Status", "Assignee", "Created", "Items"],
        state.orders.map((o) => [
          o.id, o.customer, o.status, o.assignee, o.created,
          o.items.map((line) => { const inv = itemById(line.itemId); return inv ? `${inv.sku}x${line.qty}` : `?x${line.qty}`; }).join("; ")
        ])
      );
      toast("Orders exported to CSV");
    });
  }

  // Dynamic order line management
  const addLineBtn = document.getElementById("addOrderLine");
  if (addLineBtn) {
    addLineBtn.addEventListener("click", () => {
      _orderLines.push({ itemId: state.inventory[0]?.id || 1, qty: 1 });
      const linesEl = document.getElementById("orderLines");
      if (linesEl) { linesEl.innerHTML = renderOrderLines(); bindOrderLineEvents(); }
    });
  }

  bindOrderLineEvents();

  const createBtn = document.getElementById("createOrder");
  if (createBtn) createBtn.addEventListener("click", createOrder);
}

function bindOrderLineEvents() {
  document.querySelectorAll(".line-item").forEach((select) => {
    select.addEventListener("change", () => {
      const idx = Number(select.dataset.line);
      _orderLines[idx].itemId = Number(select.value);
    });
  });
  document.querySelectorAll(".line-qty").forEach((input) => {
    input.addEventListener("input", () => {
      const idx = Number(input.dataset.line);
      _orderLines[idx].qty = Number(input.value);
    });
  });
  document.querySelectorAll(".remove-line").forEach((button) => {
    button.addEventListener("click", () => {
      const idx = Number(button.dataset.line);
      _orderLines.splice(idx, 1);
      const linesEl = document.getElementById("orderLines");
      if (linesEl) { linesEl.innerHTML = renderOrderLines(); bindOrderLineEvents(); }
    });
  });
}

function createOrder() {
  const customer = document.getElementById("orderCustomer").value.trim();
  if (!customer) return toast("Customer name is required");

  // Sync current form values into _orderLines
  document.querySelectorAll(".line-item").forEach((select) => {
    const idx = Number(select.dataset.line);
    if (_orderLines[idx]) _orderLines[idx].itemId = Number(select.value);
  });
  document.querySelectorAll(".line-qty").forEach((input) => {
    const idx = Number(input.dataset.line);
    if (_orderLines[idx]) _orderLines[idx].qty = Number(input.value);
  });

  const lines = _orderLines.filter((line) => line.qty > 0 && line.itemId);
  if (!lines.length) return toast("Add at least one item with quantity > 0");

  for (const line of lines) {
    const item = itemById(line.itemId);
    if (!item) return toast(`Item ID ${line.itemId} not found`);
    if (item.qty < line.qty) return toast(`${item.sku} only has ${item.qty} units available`);
  }

  const orderId = Math.max(...state.orders.map((o) => o.id)) + 1;
  lines.forEach((line) => {
    const item = itemById(line.itemId);
    item.qty -= line.qty;
    state.transactions.push({
      id: nextTransactionId(),
      type: "reserve_stock",
      orderId, itemId: line.itemId,
      qty: -line.qty,
      createdAt: new Date().toISOString()
    });
  });

  state.orders.unshift({
    id: orderId,
    customer,
    status: "pending",
    assignee: document.getElementById("orderAssignee").value,
    created: new Date().toISOString().slice(0, 10),
    items: lines
  });
  state.selectedOrderId = orderId;
  saveState();
  toast(`Order #${orderId} created and stock reserved`);
  app();
}

// ─── Map ──────────────────────────────────────────────────────────────────────
function bindMap() {
  const algoSelect = document.getElementById("algorithm");
  if (algoSelect) {
    algoSelect.addEventListener("change", (event) => {
      state.routeAlgorithm = event.target.value;
      saveState();
      app();
    });
  }

  const orderSelect = document.getElementById("mapOrderSelect");
  if (orderSelect) {
    orderSelect.addEventListener("change", (event) => {
      state.selectedOrderId = Number(event.target.value);
      saveState();
      app();
    });
  }
}

// ─── Manager Console ──────────────────────────────────────────────────────────
function bindManagerConsole() {
  // Release wave — with confirmation
  const releaseBtn = document.getElementById("releaseWave");
  if (releaseBtn) {
    releaseBtn.addEventListener("click", () => {
      const pending = state.orders.filter((o) => o.status === "pending");
      if (!pending.length) return toast("No pending orders to release");
      showModal("releaseWaveModal");
      const confirmBtn = document.getElementById("releaseWaveModalConfirm");
      if (confirmBtn) {
        confirmBtn.onclick = () => {
          let released = 0;
          state.orders.forEach((order) => {
            if (order.status === "pending") { order.status = "picking"; released++; }
          });
          saveState();
          hideModal("releaseWaveModal");
          toast(`${released} order${released !== 1 ? "s" : ""} released to picking`);
          app();
        };
      }
    });
    bindModalCancel("releaseWaveModal");
  }

  // Rebalance labor
  const rebalanceBtn = document.getElementById("rebalanceLabor");
  if (rebalanceBtn) {
    rebalanceBtn.addEventListener("click", () => {
      const workers = users.filter((user) => user.role === "warehouse worker");
      if (!workers.length) return toast("No warehouse workers to assign");
      state.orders.forEach((order, index) => {
        if (["pending", "picking"].includes(order.status)) {
          order.assignee = workers[index % workers.length].name;
        }
      });
      saveState();
      toast("Active orders rebalanced across floor workers");
      app();
    });
  }

  // Approve replenishment — with confirmation
  const approveBtn = document.getElementById("approveReplenishment");
  if (approveBtn) {
    approveBtn.addEventListener("click", () => {
      const low = state.inventory.filter((item) => item.qty <= item.reorder);
      if (!low.length) return toast("No items need replenishment");
      showModal("approveReplenishmentModal");
      const confirmBtn = document.getElementById("approveReplenishmentModalConfirm");
      if (confirmBtn) {
        confirmBtn.onclick = () => {
          let approved = 0;
          state.inventory.forEach((item) => {
            if (item.qty <= item.reorder) {
              const delta = item.reorder * 2 - item.qty;
              item.qty += delta;
              approved++;
              state.transactions.push({
                id: nextTransactionId(),
                type: "manager_replenishment",
                orderId: null, itemId: item.id, qty: delta,
                createdAt: new Date().toISOString()
              });
            }
          });
          saveState();
          hideModal("approveReplenishmentModal");
          toast(`${approved} replenishment request${approved !== 1 ? "s" : ""} approved`);
          app();
        };
      }
    });
    bindModalCancel("approveReplenishmentModal");
  }
}

// ─── Owner Command ────────────────────────────────────────────────────────────
function bindOwnerCommand() {
  const auditBtn = document.getElementById("runOwnerAudit");
  if (auditBtn) {
    auditBtn.addEventListener("click", () => {
      state.ownerAuditCount += 1;
      state.transactions.push({
        id: nextTransactionId(),
        type: "owner_audit",
        orderId: null, itemId: null, qty: 0,
        createdAt: new Date().toISOString()
      });
      saveState();
      toast(`Audit checkpoint #${state.ownerAuditCount} created`);
      app();
    });
  }

  const toggleBtn = document.getElementById("toggleSystemMode");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      showModal("toggleModeModal");
      const confirmBtn = document.getElementById("toggleModeModalConfirm");
      if (confirmBtn) {
        confirmBtn.onclick = () => {
          state.systemMode = state.systemMode === "live" ? "maintenance" : "live";
          saveState();
          hideModal("toggleModeModal");
          toast(`System mode changed to ${state.systemMode}`);
          app();
        };
      }
    });
    bindModalCancel("toggleModeModal");
  }
}
