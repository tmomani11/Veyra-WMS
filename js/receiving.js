function renderReceiving() {
  const filter = state.receivingQueueFilter || "all";
  const filteredQueue = state.receivingQueue.filter((item) => {
    if (filter === "ready") return item.status === "ready to putaway";
    if (filter === "hold") return item.status === "quality hold";
    return true;
  });

  return `
    <section class="scanner-layout">
      <div class="panel scanner-panel">
        <div class="panel-header">
          <div class="section-title"><h2>Scanner Console</h2><span>Barcode scan or manual entry</span></div>
          <div class="scan-modes" role="group" aria-label="Scan mode">
            ${[["new", "New SKU"], ["stock", "Stock-in"], ["audit", "Cycle Count"]].map(([mode, label]) =>
              `<button class="${state.scannerMode === mode ? "active" : ""}" data-scan-mode="${mode}" aria-pressed="${state.scannerMode === mode}">${label}</button>`
            ).join("")}
          </div>
        </div>
        <div class="scanner-console">
          <div class="scan-beam" aria-hidden="true"></div>
          <div class="field">
            <label for="scannerInput">Scan barcode or enter manually</label>
            <input id="scannerInput" class="scanner-input" placeholder="Scan or type barcode / SKU&hellip;" autocomplete="off" aria-label="Barcode scanner input" spellcheck="false">
          </div>
          <div id="scanResult" class="scan-result" role="status" aria-live="polite">Ready — scan a barcode or enter SKU to begin.</div>
        </div>
        ${renderScannerForm()}
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="section-title"><h2>Receiving Queue</h2><span>${state.receivingQueue.length} item${state.receivingQueue.length !== 1 ? "s" : ""} scanned</span></div>
          <div class="toolbar" role="group" aria-label="Filter queue">
            ${[["all", "All"], ["ready", "Ready"], ["hold", "On Hold"]].map(([f, label]) =>
              `<button class="filter-btn${filter === f ? " active" : ""}" data-queue-filter="${f}" aria-pressed="${filter === f}">${label}</button>`
            ).join("")}
          </div>
        </div>
        <div class="queue-list" id="receivingQueueList">
          ${filteredQueue.length ? filteredQueue.map((item) => `
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
          : `<p class="empty-state">No items match the selected filter.</p>`}
        </div>
        <div class="panel-footer">
          <div class="warehouse-map" aria-label="Bin heat map">${renderGrid(buildRoute(selectedOrder(), state.routeAlgorithm), true)}</div>
        </div>
      </div>
    </section>`;
}

function renderScannerForm() {
  const disabled = can("scanner:write") ? "" : "disabled";
  const isAudit = state.scannerMode === "audit";
  return `
    <div class="scanner-form">
      <div class="form-grid">
        <div class="field wide"><label for="scanBarcode">Barcode</label><input id="scanBarcode" placeholder="Auto-filled on scan" ${disabled} spellcheck="false"></div>
        <div class="field"><label for="scanSku">SKU</label><input id="scanSku" placeholder="Auto-generated" ${disabled}></div>
        <div class="field"><label for="scanName">Item name</label><input id="scanName" placeholder="Auto-filled or enter manually" ${disabled}></div>
        <div class="field">
          <label for="scanCategory">Category</label>
          <select id="scanCategory" ${disabled}>
            ${["Electronics", "Packing", "Safety", "Hardware"].map((c) => `<option>${c}</option>`)}
          </select>
        </div>
        <div class="field"><label for="scanSupplier">Supplier</label><input id="scanSupplier" placeholder="Supplier name" ${disabled}></div>
        <div class="field"><label for="scanQty">${isAudit ? "Counted qty" : "Received qty"}</label><input id="scanQty" type="number" min="1" value="1" ${disabled}></div>
        <div class="field"><label for="scanReorder">Reorder threshold</label><input id="scanReorder" type="number" min="0" value="10" ${disabled}></div>
        <div class="field"><label for="scanBin">Bin location</label><input id="scanBin" placeholder="Auto-suggested" ${disabled}></div>
        <div class="field">
          <label for="scanVelocity">Velocity</label>
          <select id="scanVelocity" ${disabled}>
            <option value="A">A – Fast mover</option>
            <option value="B" selected>B – Regular</option>
            <option value="C">C – Slow mover</option>
          </select>
        </div>
      </div>
      <div class="form-actions">
        ${isAudit
          ? `<button class="primary-btn" id="commitScan" ${disabled}>${icon("save")} Commit cycle count</button>`
          : `<button class="primary-btn" id="commitScan" ${disabled}>${icon("save")} Commit scan</button>
             <button class="secondary-btn" id="qualityHold" ${disabled}>Quality hold</button>`
        }
      </div>
    </div>`;
}
