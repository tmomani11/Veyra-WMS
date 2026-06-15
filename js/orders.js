// Tracks dynamic order line items in the create form
let _orderLines = [{ itemId: state.inventory[0]?.id || 1, qty: 1 }];

function renderOrders() {
  // Reset lines when rendering fresh
  _orderLines = [{ itemId: state.inventory[0]?.id || 1, qty: 1 }];
  return `
    <section class="split">
      <div class="panel">
        <div class="panel-header">
          <div class="section-title"><h2>Orders</h2><span>Pick tickets generated from order_items</span></div>
          <div class="toolbar">
            ${can("orders:write") ? `<button class="secondary-btn" id="exportOrdersCSV" title="Export to CSV" aria-label="Export orders to CSV">${icon("export")} Export CSV</button>` : ""}
          </div>
        </div>
        <div class="table-wrap">
          <table aria-label="Orders">
            <thead>
              <tr><th>Order</th><th>Customer</th><th>Items</th><th>Assignee</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>${state.orders.map(orderRow).join("")}</tbody>
          </table>
        </div>
      </div>
      <div class="panel">
        <div class="panel-header"><div class="section-title"><h2>Create Order</h2><span>Uses a transaction to reserve stock</span></div></div>
        ${renderOrderForm()}
      </div>
    </section>`;
}

function orderRow(order) {
  return `
    <tr>
      <td><strong>#${order.id}</strong><br><small>${order.created}</small></td>
      <td>${order.customer}</td>
      <td class="item-lines">${order.items.map((line) => {
        const inv = itemById(line.itemId);
        return inv ? `${inv.sku} &times; ${line.qty}` : `(deleted) &times; ${line.qty}`;
      }).join("<br>")}</td>
      <td>${order.assignee}</td>
      <td>${statusBadge(order.status)}</td>
      <td class="toolbar">
        <button class="icon-btn" title="View route for order #${order.id}" aria-label="View pick route for order #${order.id}" data-select-order="${order.id}">${icon("route")}</button>
        ${can("orders:write") ? `
          <select data-status-order="${order.id}" aria-label="Change status for order #${order.id}">
            ${["pending", "picking", "packed", "shipped"].map((status) => `<option ${order.status === status ? "selected" : ""}>${status}</option>`)}
          </select>` : ""}
      </td>
    </tr>`;
}

function renderOrderForm() {
  const disabled = can("orders:write") ? "" : "disabled";
  return `
    <form id="orderForm" class="form-grid" novalidate>
      <div class="field wide"><label for="orderCustomer">Customer <span class="req">*</span></label><input id="orderCustomer" value="New Customer" ${disabled} required></div>
      <div class="field wide">
        <label for="orderAssignee">Assignee</label>
        <select id="orderAssignee" ${disabled}>
          ${users.map((user) => `<option value="${user.name}">${user.name} (${user.role})</option>`)}
        </select>
      </div>
    </form>
    <div class="order-lines" id="orderLines">
      ${renderOrderLines()}
    </div>
    <div class="form-actions">
      ${can("orders:write") ? `<button class="secondary-btn" id="addOrderLine">${icon("plus")} Add item</button>` : ""}
      <button class="primary-btn" id="createOrder" ${disabled}>${icon("plus")} Create order</button>
    </div>`;
}

function renderOrderLines() {
  const disabled = can("orders:write") ? "" : "disabled";
  return _orderLines.map((line, index) => `
    <div class="order-line" data-line="${index}">
      <div class="field">
        <label>Item ${index + 1}</label>
        <select class="line-item" data-line="${index}" ${disabled}>
          ${state.inventory.map((item) => `<option value="${item.id}" ${item.id === line.itemId ? "selected" : ""}>${item.sku} — ${item.name} (${item.qty} avail)</option>`)}
        </select>
      </div>
      <div class="field line-qty-field">
        <label>Qty</label>
        <input class="line-qty" type="number" min="1" value="${line.qty}" data-line="${index}" ${disabled}>
      </div>
      ${_orderLines.length > 1 && can("orders:write") ? `<button class="icon-btn danger-icon remove-line" data-line="${index}" title="Remove line" aria-label="Remove item ${index + 1}">${icon("remove")}</button>` : ""}
    </div>`).join("");
}
