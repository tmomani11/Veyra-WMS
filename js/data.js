const STORAGE_KEY = "veyra_fulfillment_os_state_v4";
const PLATFORM_NAME = "Veyra Fulfillment OS";
const OWNER_NAME = "Tyler Momani";

const users = [
  { id: 1, name: "Tyler Momani", email: "owner@veyra.test", password: "owner123", role: "owner" },
  { id: 2, name: "Mina Patel", email: "manager@fulfilliq.test", password: "manager123", role: "manager" },
  { id: 3, name: "Jordan Lee", email: "worker@fulfilliq.test", password: "worker123", role: "warehouse worker" }
];

const permissions = {
  owner: ["inventory:write", "orders:write", "routes:run", "users:view", "db:view", "scanner:write", "manager:control", "owner:control"],
  manager: ["inventory:write", "orders:write", "routes:run", "db:view", "scanner:write", "manager:control"],
  "warehouse worker": ["orders:write", "routes:run", "scanner:write"]
};

const initialState = {
  session: null,
  activeView: "dashboard",
  selectedOrderId: 1001,
  routeAlgorithm: "astar",
  scannerMode: "new",
  systemMode: "live",
  ownerAuditCount: 0,
  darkMode: false,
  receivingQueueFilter: "all",
  inventory: [
    { id: 1, sku: "EL-0001", name: "USB-C Scanner Cradle", category: "Electronics", qty: 32, reorder: 15, aisle: "A", bin: "A-02-03", x: 2, y: 1, barcode: "88010010001", velocity: "A", supplier: "ZebraTech" },
    { id: 2, sku: "PK-0002", name: "Thermal Labels 4x6", category: "Packing", qty: 280, reorder: 120, aisle: "B", bin: "B-07-02", x: 7, y: 1, barcode: "88010010002", velocity: "A", supplier: "PackSource" },
    { id: 3, sku: "SF-0003", name: "Safety Gloves M", category: "Safety", qty: 18, reorder: 24, aisle: "C", bin: "C-04-06", x: 4, y: 5, barcode: "88010010003", velocity: "B", supplier: "SafeLine" },
    { id: 4, sku: "PK-0004", name: "Mailer Box 12in", category: "Packing", qty: 420, reorder: 150, aisle: "D", bin: "D-09-04", x: 9, y: 3, barcode: "88010010004", velocity: "A", supplier: "PackSource" },
    { id: 5, sku: "EL-0005", name: "Handheld Terminal Battery", category: "Electronics", qty: 11, reorder: 18, aisle: "E", bin: "E-10-07", x: 10, y: 6, barcode: "88010010005", velocity: "B", supplier: "VoltEdge" },
    { id: 6, sku: "HW-0006", name: "Shelf Divider Kit", category: "Hardware", qty: 66, reorder: 30, aisle: "F", bin: "F-01-07", x: 1, y: 6, barcode: "88010010006", velocity: "C", supplier: "RackWorks" }
  ],
  orders: [
    { id: 1001, customer: "Northstar Retail", status: "pending", assignee: "Jordan Lee", created: "2026-05-24", items: [{ itemId: 1, qty: 3 }, { itemId: 3, qty: 12 }, { itemId: 5, qty: 4 }] },
    { id: 1002, customer: "Cascadia Parts", status: "picking", assignee: "Jordan Lee", created: "2026-05-24", items: [{ itemId: 2, qty: 50 }, { itemId: 4, qty: 24 }] },
    { id: 1003, customer: "Summit Supply", status: "packed", assignee: "Mina Patel", created: "2026-05-23", items: [{ itemId: 6, qty: 16 }, { itemId: 1, qty: 2 }] },
    { id: 1004, customer: "Blue Harbor", status: "shipped", assignee: "Mina Patel", created: "2026-05-22", items: [{ itemId: 4, qty: 44 }, { itemId: 2, qty: 90 }, { itemId: 3, qty: 5 }] }
  ],
  transactions: [
    { id: 1, type: "order_pick", orderId: 1004, itemId: 4, qty: -44, createdAt: "2026-05-22T10:20:00" },
    { id: 2, type: "cycle_count", orderId: null, itemId: 3, qty: 18, createdAt: "2026-05-24T08:30:00" }
  ],
  receivingQueue: [
    { id: 1, barcode: "99124880011", sku: "PK-0007", name: "Air Pillows 8x4", qty: 160, bin: "B-03-01", status: "ready to putaway", scannedAt: "2026-05-24T09:05:00" },
    { id: 2, barcode: "99124880012", sku: "EL-0008", name: "Scanner Wrist Strap", qty: 40, bin: "A-01-02", status: "quality hold", scannedAt: "2026-05-24T09:18:00" }
  ],
  blocked: [{ x: 5, y: 3 }, { x: 5, y: 4 }, { x: 6, y: 4 }, { x: 8, y: 6 }],
  heat: { "2,1": 8, "4,5": 14, "10,6": 12, "7,1": 18, "9,3": 16, "1,6": 6 }
};

let state = loadState();

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    if (parsed.darkMode === undefined) parsed.darkMode = false;
    if (parsed.receivingQueueFilter === undefined) parsed.receivingQueueFilter = "all";
    return parsed;
  }
  return structuredClone(initialState);
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function createToken(user) {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify({ sub: user.id, role: user.role, name: user.name, iat: Date.now() }));
  const signature = btoa(`${user.email}:fulfilliq-demo-secret`).slice(0, 24);
  return `${header}.${payload}.${signature}`;
}

function currentUser() {
  if (!state.session) return null;
  return users.find((user) => user.id === state.session.userId) || null;
}

function can(action) {
  const user = currentUser();
  return user && permissions[user.role].includes(action);
}

// Safe next transaction ID — not dependent on array length (avoids collision after deletes)
function nextTransactionId() {
  if (!state.transactions.length) return 1;
  return Math.max(...state.transactions.map((t) => t.id)) + 1;
}

// SVG icon library — replaces the single-letter placeholders
function icon(name) {
  const icons = {
    dashboard: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
    inventory: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`,
    receiving: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>`,
    orders: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
    map: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>`,
    route: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/></svg>`,
    manager: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    owner: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    database: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
    plus: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    edit: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
    del: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
    save: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`,
    logout: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
    export: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
    sun: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
    moon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
    remove: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
  };
  return icons[name] || `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/></svg>`;
}

function statusBadge(status) {
  const cls = { pending: "warn", picking: "blue", packed: "good", shipped: "good" }[status] || "";
  return `<span class="badge ${cls}">${status}</span>`;
}

function lowStockBadge(item) {
  if (item.qty <= item.reorder) return `<span class="badge danger">low stock</span>`;
  if (item.qty <= item.reorder * 1.4) return `<span class="badge warn">watch</span>`;
  return `<span class="badge good">healthy</span>`;
}

// Confirmation modal helpers
function renderConfirmModal(id, title, message, confirmLabel, danger) {
  return `
    <div class="modal-overlay" id="${id}" role="dialog" aria-modal="true" aria-labelledby="${id}Title">
      <div class="modal">
        <h3 id="${id}Title">${title}</h3>
        <p>${message}</p>
        <div class="modal-actions">
          <button class="${danger ? "danger-btn" : "primary-btn"}" id="${id}Confirm">${confirmLabel || "Confirm"}</button>
          <button class="secondary-btn" id="${id}Cancel">Cancel</button>
        </div>
      </div>
    </div>`;
}

function showModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add("visible"); el.querySelector("button")?.focus(); }
}

function hideModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("visible");
}

function bindModalCancel(id) {
  const cancelBtn = document.getElementById(`${id}Cancel`);
  if (cancelBtn) cancelBtn.addEventListener("click", () => hideModal(id));
  const overlay = document.getElementById(id);
  if (overlay) overlay.addEventListener("click", (e) => { if (e.target === overlay) hideModal(id); });
}
