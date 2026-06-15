function renderLogin() {
  return `
    <main class="login-shell" role="main">
      <section class="login-panel">
        <div class="brand" aria-label="${PLATFORM_NAME}"><span class="brand-mark" aria-hidden="true">VF</span><span>${PLATFORM_NAME}</span></div>
        <span class="owner-pill">Owner: ${OWNER_NAME}</span>
        <div class="login-copy">
          <h1>Enterprise warehouse execution for modern fulfillment teams.</h1>
          <p>Secure access to inventory control, scanner receiving, route optimization, labor oversight, and executive warehouse operations.</p>
        </div>
        <form class="login-form" id="loginForm" novalidate>
          <div class="field">
            <label for="email">Email</label>
            <input id="email" type="email" value="owner@veyra.test" autocomplete="username" aria-required="true">
          </div>
          <div class="field">
            <label for="password">Password</label>
            <input id="password" value="owner123" type="password" autocomplete="current-password" aria-required="true">
          </div>
          <button class="primary-btn" type="submit">Sign in</button>
        </form>
        <p class="login-hint">Demo accounts: owner@veyra.test / manager@fulfilliq.test / worker@fulfilliq.test</p>
      </section>
      <aside class="hero-stats" aria-label="Platform highlights">
        <div class="hero-stat"><strong>Control</strong><span>role-secured operations</span></div>
        <div class="hero-stat"><strong>Optimize</strong><span>guided route intelligence</span></div>
        <div class="hero-stat"><strong>Execute</strong><span>scanner-ready workflows</span></div>
      </aside>
    </main>`;
}

function bindLogin() {
  const submitLogin = (event) => {
    event.preventDefault();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const user = users.find((entry) => entry.email === email && entry.password === password);
    if (!user) return toast("Invalid credentials — check email and password");
    state.session = { userId: user.id, token: createToken(user) };
    saveState();
    app();
  };
  document.getElementById("loginForm").addEventListener("submit", submitLogin);
}

function renderShell() {
  const user = currentUser();
  const nav = [
    ["dashboard", "Dashboard"],
    ["inventory", "Inventory"],
    ["receiving", "Receiving Scan"],
    ["orders", "Orders"],
    ["map", "Warehouse Map"],
    ["manager", "Manager Console", "manager:control"],
    ["owner", "Owner Command", "owner:control"],
    ["database", "Database", "db:view"]
  ].filter(([, , permission]) => !permission || can(permission));

  if (
    (state.activeView === "database" && !can("db:view")) ||
    (state.activeView === "manager" && !can("manager:control")) ||
    (state.activeView === "owner" && !can("owner:control"))
  ) {
    state.activeView = "dashboard";
    saveState();
  }

  return `
    <div class="app-shell${state.darkMode ? " dark" : ""}">
      <aside class="sidebar" role="navigation" aria-label="Main navigation">
        <div class="brand" aria-label="${PLATFORM_NAME}"><span class="brand-mark" aria-hidden="true">VF</span><span>${PLATFORM_NAME}</span></div>
        <div class="owner-strip" aria-label="Owner">Owner / ${OWNER_NAME}</div>
        <nav class="nav" aria-label="Views">
          ${nav.map(([id, label]) => `<button class="${state.activeView === id ? "active" : ""}" data-view="${id}" aria-label="${label}" aria-current="${state.activeView === id ? "page" : "false"}"><span class="nav-icon">${icon(id)}</span>${label}</button>`).join("")}
        </nav>
        <div class="user-card" aria-label="Current user">
          <strong>${user.name}</strong>
          <small>${user.role}</small>
          <small>Mode: <span class="mode-badge ${state.systemMode === "maintenance" ? "warn" : ""}">${state.systemMode}</span></small>
          <small title="${state.session.token}" class="jwt-preview">JWT active &mdash; ${state.session.token.slice(0, 18)}&hellip;</small>
          <button class="secondary-btn" id="logout" aria-label="Sign out">${icon("logout")} Sign out</button>
        </div>
      </aside>
      <main class="main" id="mainContent" tabindex="-1">
        <header class="topbar" role="banner">
          <div>
            <h1>${viewTitle()}</h1>
            <p>${viewSubtitle()}</p>
          </div>
          <div class="toolbar">
            <span class="badge blue" aria-label="Role: ${user.role}">${user.role}</span>
            <span class="badge" aria-label="Today's date">${new Date().toLocaleDateString()}</span>
            <button class="icon-btn" id="darkModeToggle" title="${state.darkMode ? "Switch to light mode" : "Switch to dark mode"}" aria-label="${state.darkMode ? "Switch to light mode" : "Switch to dark mode"}">${state.darkMode ? icon("sun") : icon("moon")}</button>
          </div>
        </header>
        <section class="content" aria-label="${viewTitle()}">${renderView()}</section>
      </main>
    </div>`;
}

function viewTitle() {
  return {
    dashboard: "Operations Command Center",
    inventory: "Inventory Management",
    receiving: "Scanner Receiving",
    orders: "Order Management",
    map: "Warehouse Map",
    manager: "Manager Console",
    owner: "Owner Command",
    database: "Database Design"
  }[state.activeView] || "Dashboard";
}

function viewSubtitle() {
  return {
    dashboard: "Inventory health, active fulfillment, pick efficiency, and hot zones.",
    inventory: "SKU generation, quantity controls, shelf locations, low stock, and barcode records.",
    receiving: "Scan new SKUs from a barcode scanner, validate duplicates, and create putaway work.",
    orders: "Create orders, assign pick tickets, and move fulfillment through pending, picking, packed, shipped.",
    map: "Grid bins, coordinates, heat maps, and optimized multi-item pick routes.",
    manager: "Plan waves, approve replenishment, balance labor, and monitor worker execution.",
    owner: "Tyler-only executive controls, access matrix, audit tools, and warehouse operating mode.",
    database: "Relational schema, foreign keys, indexes, and transactional workflows."
  }[state.activeView] || "";
}

function renderView() {
  if (
    (state.activeView === "database" && !can("db:view")) ||
    (state.activeView === "manager" && !can("manager:control")) ||
    (state.activeView === "owner" && !can("owner:control"))
  ) {
    return renderDashboard();
  }
  return {
    dashboard: renderDashboard,
    inventory: renderInventory,
    receiving: renderReceiving,
    orders: renderOrders,
    map: renderMapView,
    manager: renderManagerConsole,
    owner: renderOwnerCommand,
    database: renderDatabase
  }[state.activeView]();
}
