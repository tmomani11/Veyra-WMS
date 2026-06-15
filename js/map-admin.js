function renderMapView() {
  const order = selectedOrder();
  const route = buildRoute(order, state.routeAlgorithm);
  const orderOptions = state.orders.map((o) =>
    `<option value="${o.id}" ${o.id === state.selectedOrderId ? "selected" : ""}>#${o.id} — ${o.customer} (${o.status})</option>`
  ).join("");

  return `
    <section class="map-layout">
      <div class="panel">
        <div class="panel-header">
          <div class="section-title"><h2>Warehouse Layout</h2><span>12 &times; 8 grid &bull; dock at (0, 0)</span></div>
          <div class="toolbar">
            <select id="mapOrderSelect" aria-label="Select order to route">
              ${orderOptions}
            </select>
            <select id="algorithm" aria-label="Routing algorithm">
              <option value="astar" ${state.routeAlgorithm === "astar" ? "selected" : ""}>A* (optimal)</option>
              <option value="dijkstra" ${state.routeAlgorithm === "dijkstra" ? "selected" : ""}>Dijkstra</option>
              <option value="greedy" ${state.routeAlgorithm === "greedy" ? "selected" : ""}>Greedy nearest-neighbor</option>
            </select>
          </div>
        </div>
        <div class="warehouse-map">${renderGrid(route, false)}</div>
        <div class="map-legend">
          <span class="legend-dot start"></span><span>Dock</span>
          <span class="legend-dot bin"></span><span>Bin</span>
          <span class="legend-dot route"></span><span>Path</span>
          <span class="legend-dot pick"></span><span>Pick stop</span>
          <span class="legend-dot blocked"></span><span>Blocked</span>
        </div>
      </div>
      <div class="panel">
        <div class="panel-header">
          <div class="section-title"><h2>Pick Route</h2><span>Order #${order.id} &mdash; ${route.algorithm}</span></div>
        </div>
        <div class="route-summary">
          <div class="metric"><span>Walking distance</span><strong>${route.distance}</strong><em>grid steps</em></div>
          <div class="metric"><span>Route savings</span><strong>${route.savings}%</strong><em>vs order entry sequence</em></div>
          <div class="metric"><span>Pick stops</span><strong>${route.order.length}</strong><em>bin locations</em></div>
        </div>
        <div class="pick-list" aria-label="Pick sequence">
          ${route.order.length ? route.order.map((point, index) => {
            const item = state.inventory.find((entry) => entry.x === point.x && entry.y === point.y);
            if (!item) return "";
            const orderLine = order.items.find((line) => line.itemId === item.id);
            return `
              <div class="pick-ticket ${index === 0 ? "active" : ""}">
                <strong>${index + 1}. ${item.name}</strong>
                <div class="pick-row">
                  <span>${item.sku}</span>
                  <span>${item.bin}</span>
                  ${orderLine ? `<span class="badge blue">pick ${orderLine.qty}</span>` : ""}
                </div>
              </div>`;
          }).join("") : `<p class="empty-state">No pick stops for this order.</p>`}
        </div>
      </div>
    </section>`;
}

function renderManagerConsole() {
  const pending = state.orders.filter((order) => order.status === "pending");
  const picking = state.orders.filter((order) => order.status === "picking");
  const low = state.inventory.filter((item) => item.qty <= item.reorder);
  const workerLoad = users
    .filter((user) => user.role === "warehouse worker" || user.role === "manager")
    .map((user) => ({
      user,
      count: state.orders.filter((order) =>
        order.assignee === user.name && ["pending", "picking"].includes(order.status)
      ).length
    }));

  return `
    <section class="metric-grid" aria-label="Manager metrics">
      <div class="metric"><span>Pending wave</span><strong>${pending.length}</strong><em>orders ready to release</em></div>
      <div class="metric"><span>Currently picking</span><strong>${picking.length}</strong><em>active floor work</em></div>
      <div class="metric"><span>Replenishment needed</span><strong>${low.length}</strong><em>SKUs under threshold</em></div>
      <div class="metric"><span>Scanner queue</span><strong>${state.receivingQueue.length}</strong><em>inbound tasks</em></div>
    </section>
    <section class="split">
      <div class="panel">
        <div class="panel-header"><div class="section-title"><h2>Wave Planning</h2><span>Manager-only control for releasing work to the floor</span></div></div>
        <div class="command-list">
          ${pending.length ? pending.map((order) => {
            const route = buildRoute(order, state.routeAlgorithm);
            return `
              <article class="command-card">
                <div>
                  <strong>Order #${order.id}</strong>
                  <span>${order.customer} &bull; ${order.items.length} line${order.items.length !== 1 ? "s" : ""} &bull; ${route.distance} steps &bull; assigned to ${order.assignee}</span>
                </div>
                ${statusBadge(order.status)}
              </article>`;
          }).join("") : `<article class="command-card"><div><strong>No pending orders</strong><span>The current wave is already released.</span></div></article>`}
        </div>
        <div class="form-actions">
          <button class="primary-btn" id="releaseWave" aria-label="Release all pending orders to picking">${icon("orders")} Release wave</button>
          <button class="secondary-btn" id="rebalanceLabor" aria-label="Rebalance orders across workers">${icon("manager")} Rebalance labor</button>
        </div>
      </div>
      <div class="panel">
        <div class="panel-header"><div class="section-title"><h2>Labor Board</h2><span>Active assignments per worker</span></div></div>
        <div class="queue-list">
          ${workerLoad.map(({ user, count }) => `
            <article class="queue-card">
              <div>
                <strong>${user.name}</strong>
                <span>${user.role}</span>
              </div>
              <span class="badge ${count > 2 ? "warn" : count > 0 ? "blue" : "good"}">${count} active task${count !== 1 ? "s" : ""}</span>
            </article>`).join("")}
        </div>
      </div>
    </section>
    <section class="panel">
      <div class="panel-header"><div class="section-title"><h2>Replenishment Work</h2><span>Approve restock before workers pick from constrained bins</span></div></div>
      <div class="command-list">
        ${low.length ? low.map((item) => `
          <article class="command-card">
            <div>
              <strong>${item.sku} — ${item.name}</strong>
              <span>${item.qty} on hand &bull; reorder point ${item.reorder} &bull; supplier: ${item.supplier || "unassigned"}</span>
            </div>
            <span class="badge danger">needs approval</span>
          </article>`).join("")
        : `<article class="command-card"><div><strong>No replenishment needed</strong><span>All SKUs are above reorder threshold.</span></div></article>`}
      </div>
      <div class="form-actions">
        <button class="primary-btn" id="approveReplenishment" aria-label="Approve all replenishment requests">${icon("inventory")} Approve replenishment</button>
      </div>
    </section>
    ${renderConfirmModal("releaseWaveModal", "Release Wave", `Release all ${pending.length} pending order${pending.length !== 1 ? "s" : ""} to picking status?`, "Release wave")}
    ${renderConfirmModal("approveReplenishmentModal", "Approve Replenishment", `Approve restocking for ${low.length} SKU${low.length !== 1 ? "s" : ""}? This will update inventory quantities.`, "Approve")}`;
}

function renderOwnerCommand() {
  const rows = [
    ["Owner", "Full access, operating mode, audit, database, user governance"],
    ["Manager", "Inventory control, wave planning, replenishment, reports, database"],
    ["Warehouse worker", "Scanner receiving, order status, pick routes, read-only inventory"]
  ];
  return `
    <section class="owner-hero" aria-label="Owner command">
      <div>
        <span class="owner-pill">Tyler-only workspace</span>
        <h2>${OWNER_NAME} Command Authority</h2>
        <p>Executive controls for the warehouse system: operating mode, audit snapshots, role visibility, and exception oversight.</p>
      </div>
      <div class="owner-mode">
        <span>System mode</span>
        <strong class="${state.systemMode === "maintenance" ? "mode-maintenance" : ""}">${state.systemMode}</strong>
      </div>
    </section>
    <section class="split">
      <div class="panel">
        <div class="panel-header"><div class="section-title"><h2>Owner Powers</h2><span>Restricted to ${OWNER_NAME}</span></div></div>
        <div class="command-list">
          <article class="command-card">
            <div>
              <strong>Executive audit</strong>
              <span>Capture a high-level operational checkpoint for compliance and review.</span>
            </div>
            <button class="secondary-btn" id="runOwnerAudit" aria-label="Run executive audit">${icon("database")} Run audit</button>
          </article>
          <article class="command-card">
            <div>
              <strong>Operating mode</strong>
              <span>Switch between live fulfillment and controlled maintenance mode. Current: <strong>${state.systemMode}</strong></span>
            </div>
            <button class="secondary-btn ${state.systemMode === "maintenance" ? "danger-btn" : ""}" id="toggleSystemMode" aria-label="Toggle system mode">${icon("owner")} Toggle mode</button>
          </article>
          <article class="command-card">
            <div>
              <strong>Exception override</strong>
              <span>Owner can override constrained stock or blocked-bin exceptions.</span>
            </div>
            <span class="badge blue">available</span>
          </article>
        </div>
      </div>
      <div class="panel">
        <div class="panel-header"><div class="section-title"><h2>Access Matrix</h2><span>Separation of duties</span></div></div>
        <div class="access-list">
          ${rows.map(([role, scope]) => `<article><strong>${role}</strong><span>${scope}</span></article>`).join("")}
        </div>
      </div>
    </section>
    <section class="metric-grid" aria-label="Owner metrics">
      <div class="metric"><span>Owner audits</span><strong>${state.ownerAuditCount}</strong><em>executive checkpoints</em></div>
      <div class="metric"><span>Restricted views</span><strong>3</strong><em>owner, manager, database</em></div>
      <div class="metric"><span>Active users</span><strong>${users.length}</strong><em>role-governed accounts</em></div>
      <div class="metric"><span>Mode</span><strong>${state.systemMode}</strong><em>warehouse operating state</em></div>
    </section>
    ${renderConfirmModal("toggleModeModal", "Toggle System Mode", `Switch system from <strong>${state.systemMode}</strong> to <strong>${state.systemMode === "live" ? "maintenance" : "live"}</strong> mode?`, "Toggle mode", state.systemMode === "live")}`;
}

function renderGrid(route, heatOnly) {
  const routeKeys = new Set((route.path || []).map((p) => `${p.x},${p.y}`));
  const pickKeys = new Set((route.order || []).map((p) => `${p.x},${p.y}`));
  const blockedKeys = new Set(state.blocked.map((p) => `${p.x},${p.y}`));
  let html = `<div class="grid" role="img" aria-label="Warehouse grid layout">`;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 12; x++) {
      const key = `${x},${y}`;
      const item = state.inventory.find((entry) => entry.x === x && entry.y === y);
      const heat = state.heat[key] || 0;
      const heatClass = heat > 14 ? "heat-3" : heat > 8 ? "heat-2" : heat > 0 ? "heat-1" : "";
      const classes = ["cell"];
      if (x === 0 && y === 0) classes.push("start");
      if (item) classes.push("bin");
      if (blockedKeys.has(key)) classes.push("blocked");
      if (!heatOnly && routeKeys.has(key)) classes.push("route");
      if (!heatOnly && pickKeys.has(key)) classes.push("pick");
      if (heatOnly) classes.push(heatClass);
      const label = x === 0 && y === 0 ? "Dock" : item ? item.aisle : "";
      const title = item ? `${item.sku} — ${item.bin} (${item.qty} units)` : `(${x}, ${y})`;
      html += `<div class="${classes.join(" ")}" title="${title}" aria-label="${title}">${label}</div>`;
    }
  }
  return html + `</div>`;
}
