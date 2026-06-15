function app() {
  const root = document.getElementById("app");
  if (!currentUser()) {
    root.innerHTML = renderLogin();
    bindLogin();
    applyDarkMode();
    return;
  }
  root.innerHTML = renderShell();
  bindShell();
  applyDarkMode();
}

function applyDarkMode() {
  document.documentElement.classList.toggle("dark", !!state.darkMode);
}

let _toastTimer = null;
function toast(message, type) {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();
  if (_toastTimer) clearTimeout(_toastTimer);

  const div = document.createElement("div");
  div.className = `toast${type === "error" ? " toast-error" : type === "success" ? " toast-success" : ""}`;
  div.setAttribute("role", "status");
  div.setAttribute("aria-live", "polite");
  div.textContent = message;
  document.body.appendChild(div);

  // Animate in
  requestAnimationFrame(() => div.classList.add("toast-visible"));

  _toastTimer = setTimeout(() => {
    div.classList.remove("toast-visible");
    setTimeout(() => div.remove(), 300);
  }, 2800);
}

app();
