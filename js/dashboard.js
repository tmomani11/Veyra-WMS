function metrics() {
  const totalInventory = state.inventory.reduce((sum, item) => sum + item.qty, 0);
  const activeOrders = state.orders.filter((order) => ["pending", "picking"].includes(order.status)).length;
  const allRoutes = state.orders.map((order) => buildRoute(order, state.routeAlgorithm));
  const baseline = allRoutes.reduce((sum, route) => sum + route.baselineDistance, 0);
  const optimized = allRoutes.reduce((sum, route) => sum + route.distance, 0);
  const efficiency = baseline ? Math.round((1 - optimized / baseline) * 100) : 0;
  const lowStock = state.inventory.filter((item) => item.qty <= item.reorder).length;
  const inboundUnits = state.receivingQueue.reduce((sum, item) => sum + item.qty, 0);
  const riskOrders = state.orders.filter((order) =>
    order.items.some((line) => {
      const inv = itemById(line.itemId);
      return inv && inv.qty <= inv.reorder;
    })
  ).length;
  return { totalInventory, activeOrders, efficiency, lowStock, inboundUnits, riskOrders };
}

function renderDashboard() {
  const m = metrics();
  const statuses = ["pending", "picking", "packed", "shipped"];
  const counts = statuses.map((s) => state.orders.filter((o) => o.status === s).length);
  const maxCount = Math.max(...counts, 1);

  return `
    <section class="metric-grid" aria-label="Key metrics">
      <div class="metric">
        <span>Total inventory</span>
        <strong>${m.totalInventory.toLocaleString()}</strong>
        <em>units across ${state.inventory.length} SKUs</em>
      </div>
      <div class="metric">
        <span>Active orders</span>
        <strong>${m.activeOrders}</strong>
        <em>pending or picking</em>
      </div>
      <div class="metric">
        <span>Pick efficiency</span>
        <strong>${m.efficiency}%</strong>
        <em>route distance reduction</em>
      </div>
      <div class="metric">
        <span>Inbound receiving</span>
        <strong>${m.inboundUnits.toLocaleString()}</strong>
        <em>units scanned for putaway</em>
      </div>
    </section>
    <section class="signal-grid" aria-label="Operational signals">
      ${renderSignals()}
    </section>
    <section class="split">
      <div class="panel">
        <div class="panel-header">
          <div class="section-title"><h2>Fulfillment Pipeline</h2><span>Orders by workflow state</span></div>
        </div>
        <div class="chart-bars">
          ${statuses.map((status, i) => {
            const count = counts[i];
            const pct = Math.round((count / maxCount) * 100);
            return `
              <div class="bar-row">
                <strong>${status}</strong>
                <div class="bar-track" role="progressbar" aria-valuenow="${count}" aria-valuemax="${maxCount}" aria-label="${status}: ${count} orders">
                  <div class="bar-fill bar-${status}" style="width:${pct}%"></div>
                </div>
                <span>${count}</span>
              </div>`;
          }).join("")}
        </div>
      </div>
      <div class="panel">
        <div class="panel-header">
          <div class="section-title"><h2>Pick Frequency Heat Map</h2><span>Bin activity by pick count</span></div>
        </div>
        <div class="warehouse-map">${renderGrid(buildRoute(selectedOrder(), state.routeAlgorithm), true)}</div>
        <div class="heat-legend">
          <span class="heat-dot heat-1"></span><span>Low</span>
          <span class="heat-dot heat-2"></span><span>Medium</span>
          <span class="heat-dot heat-3"></span><span>High</span>
        </div>
      </div>
    </section>
    <section class="panel">
      <div class="panel-header">
        <div class="section-title"><h2>Low Stock Alerts</h2><span>${m.lowStock} SKU${m.lowStock !== 1 ? "s" : ""} below reorder threshold</span></div>
      </div>
      ${renderLowStockTable()}
    </section>`;
}

function renderLowStockTable() {
  const low = state.inventory.filter((item) => item.qty <= item.reorder * 1.4);
  if (!low.length) {
    return `<p class="empty-state">All SKUs are above reorder threshold. No action required.</p>`;
  }
  return `
    <div class="table-wrap">
      <table aria-label="Low stock items">
        <thead><tr><th>SKU</th><th>Name</th><th>On Hand</th><th>Reorder Point</th><th>Supplier</th><th>Status</th></tr></thead>
        <tbody>
          ${low.map((item) => `
            <tr>
              <td><strong>${item.sku}</strong></td>
              <td>${item.name}</td>
              <td>${item.qty}</td>
              <td>${item.reorder}</td>
              <td>${item.supplier || "—"}</td>
              <td>${lowStockBadge(item)}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

function renderSignals() {
  const low = state.inventory.filter((item) => item.qty <= item.reorder);
  const fastFar = state.inventory.filter((item) => item.velocity === "A" && item.x > 6);
  const nextOrder = state.orders.find((order) => order.status === "pending") || state.orders[0];
  const route = buildRoute(nextOrder, state.routeAlgorithm);
  const m = metrics();
  const cards = [
    ["Replenishment priority", low.length
      ? `${low.map((item) => item.sku).join(", ")} below reorder point`
      : "No urgent replenishment work"],
    ["Smart slotting", fastFar.length
      ? `Move ${fastFar[0].sku} closer to dock to reduce repeat travel`
      : "Fast movers are near efficient pick lanes"],
    ["SLA risk", `${m.riskOrders} active order${m.riskOrders !== 1 ? "s" : ""} touch${m.riskOrders === 1 ? "es" : ""} constrained inventory`],
    ["Wave batching", `Batch order #${nextOrder.id} route at ${route.distance} grid steps with ${route.savings}% savings`]
  ];
  return cards.map(([title, body]) => `
    <article class="signal">
      <strong>${title}</strong>
      <span>${body}</span>
    </article>`).join("");
}
