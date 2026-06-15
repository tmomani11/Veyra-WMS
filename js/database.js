function renderDatabase() {
  const schema = [
    ["users", "id PK\nname\nemail UNIQUE INDEX\npassword_hash\nrole CHECK(admin, manager, worker)"],
    ["inventory_items", "id PK\nsku UNIQUE INDEX\nname\nqty\nreorder_threshold\nbarcode UNIQUE\nbin_id FK -> bins.id"],
    ["bins", "id PK\naisle\nlabel UNIQUE\nx_index INDEX\ny_index INDEX"],
    ["orders", "id PK\ncustomer\nstatus INDEX\nassignee_id FK -> users.id\ncreated_at"],
    ["order_items", "order_id FK -> orders.id\nitem_id FK -> inventory_items.id\nqty\nPRIMARY KEY(order_id, item_id)"],
    ["receiving_queue", "id PK\nbarcode INDEX\nsku\nqty\nbin_id FK -> bins.id\nstatus INDEX\nscanned_at"],
    ["inventory_transactions", "id PK\nitem_id FK -> inventory_items.id\norder_id FK -> orders.id NULL\nqty_delta\ncreated_at INDEX"]
  ];
  return `
    <section class="panel">
      <div class="panel-header"><div class="section-title"><h2>Relational Database Features</h2><span>Normalized tables, foreign keys, indexing, and transactional stock reservation</span></div></div>
      <div class="db-schema">${schema.map(([name, fields]) => `<article class="schema-card"><h3>${name}</h3><code>${fields}</code></article>`).join("")}</div>
    </section>
    <section class="panel">
      <div class="panel-header"><div class="section-title"><h2>Transaction Log</h2><span>Stock changes are append-only for auditability</span></div></div>
      <div class="table-wrap"><table aria-label="Transaction log"><thead><tr><th>ID</th><th>Type</th><th>Order</th><th>SKU</th><th>Delta</th><th>Timestamp</th></tr></thead><tbody>
        ${state.transactions.slice().reverse().map((tx) => {
          const delta = tx.qty;
          const deltaClass = delta > 0 ? "good" : delta < 0 ? "danger" : "";
          const deltaStr = delta > 0 ? `+${delta}` : String(delta);
          return `<tr><td class="mono">${tx.id}</td><td><span class="badge">${tx.type.replace(/_/g, " ")}</span></td><td>${tx.orderId ? `#${tx.orderId}` : "—"}</td><td>${itemById(tx.itemId)?.sku || "—"}</td><td><span class="badge ${deltaClass}">${deltaStr}</span></td><td class="mono">${new Date(tx.createdAt).toLocaleString()}</td></tr>`;
        }).join("")}
      </tbody></table></div>
    </section>`;
}
