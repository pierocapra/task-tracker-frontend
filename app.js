// ---------------------------------------------------------------------------
// app.js — talks to whichever backend STACK_CONFIG points at.
// Assumed API shape (adjust API_ROUTES / field names in config.js if yours differs):
//   POST  /api/auth/signup { name, email, password } -> { token, user }
//   POST  /api/auth/login  { email, password }        -> { token, user }
//   GET   /api/tasks                                   -> [ { id, title, description, completed, createdAt } ]
//   POST  /api/tasks       { title, description }      -> task
//   PUT   /api/tasks/:id   { title, description, completed } -> task
//   DELETE /api/tasks/:id
// ---------------------------------------------------------------------------

const STORAGE_KEYS = {
  activeStack: "tt_active_stack",
  token: (stack) => `tt_token_${stack}`,
  userLabel: (stack) => `tt_user_${stack}`,
  customBaseUrl: (stack) => `tt_base_override_${stack}`,
};

let state = {
  stack: localStorage.getItem(STORAGE_KEYS.activeStack) || "node",
  token: null,
  userLabel: null,
};

// ---------- helpers ----------

function currentBaseUrl() {
  const override = localStorage.getItem(STORAGE_KEYS.customBaseUrl(state.stack));
  if (override) return override;
  return STACK_CONFIG[state.stack]?.baseUrl || "";
}

function apiUrl(path) {
  return currentBaseUrl().replace(/\/$/, "") + path;
}

async function apiFetch(path, options = {}) {
  const headers = Object.assign({ "Content-Type": "application/json" }, options.headers || {});
  if (state.token) headers["Authorization"] = `Bearer ${state.token}`;
  const res = await fetch(apiUrl(path), { ...options, headers });
  let body = null;
  try { body = await res.json(); } catch (_) { /* no body */ }
  if (!res.ok) {
    const message = (body && (body.error || body.message)) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body;
}

function setError(scope, message) {
  const el = document.querySelector(`.form-error[data-for="${scope}"]`);
  if (el) el.textContent = message || "";
}

// ---------- connection status ----------

async function refreshConnectionStatus() {
  const dot = document.getElementById("connDot");
  const statusEl = document.getElementById("connStatus");
  const display = document.getElementById("apiBaseDisplay");
  const base = currentBaseUrl();

  display.textContent = base || "(no URL set)";

  if (!base) {
    dot.className = "conn-dot is-down";
    statusEl.textContent = "not configured";
    return;
  }

  dot.className = "conn-dot";
  statusEl.textContent = "checking…";
  try {
    // Hits a dedicated /health route on the backend — see deploy notes for the
    // matching Express route. A 404 here usually means /health hasn't been added yet.
    const res = await fetch(`${base.replace(/\/$/, "")}/health`, { method: "GET", mode: "cors" });
    if (res.ok) {
      dot.className = "conn-dot is-ok";
      statusEl.textContent = "reachable";
    } else {
      dot.className = "conn-dot is-down";
      statusEl.textContent = `responded ${res.status}`;
    }
  } catch (_) {
    dot.className = "conn-dot is-down";
    statusEl.textContent = "unreachable";
  }
}

// ---------- stack switcher ----------

function initStackSwitcher() {
  const buttons = document.querySelectorAll(".stack-tab");
  buttons.forEach((btn) => {
    const stack = btn.dataset.stack;
    if (stack === state.stack) btn.classList.add("is-active");
    if (!btn.disabled) {
      btn.addEventListener("click", () => switchStack(stack));
    }
  });

  document.getElementById("editApiBase").addEventListener("click", () => {
    const current = currentBaseUrl();
    const next = prompt(`Set the API base URL for ${STACK_CONFIG[state.stack].label}:`, current || "");
    if (next !== null) {
      localStorage.setItem(STORAGE_KEYS.customBaseUrl(state.stack), next.trim());
      refreshConnectionStatus();
    }
  });
}

function switchStack(stack) {
  state.stack = stack;
  localStorage.setItem(STORAGE_KEYS.activeStack, stack);
  document.querySelectorAll(".stack-tab").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.stack === stack);
  });
  loadSessionForStack();
  refreshConnectionStatus();
}

// ---------- session ----------

function loadSessionForStack() {
  state.token = localStorage.getItem(STORAGE_KEYS.token(state.stack));
  state.userLabel = localStorage.getItem(STORAGE_KEYS.userLabel(state.stack));
  renderAuthState();
  if (state.token) loadTasks();
}

function saveSession(token, userLabel) {
  state.token = token;
  state.userLabel = userLabel;
  localStorage.setItem(STORAGE_KEYS.token(state.stack), token);
  localStorage.setItem(STORAGE_KEYS.userLabel(state.stack), userLabel);
}

function clearSession() {
  state.token = null;
  state.userLabel = null;
  localStorage.removeItem(STORAGE_KEYS.token(state.stack));
  localStorage.removeItem(STORAGE_KEYS.userLabel(state.stack));
}

function renderAuthState() {
  const authCard = document.getElementById("authCard");
  const taskCard = document.getElementById("taskCard");
  if (state.token) {
    authCard.classList.add("is-hidden");
    taskCard.classList.remove("is-hidden");
    document.getElementById("userLabel").textContent = state.userLabel || "—";
  } else {
    authCard.classList.remove("is-hidden");
    taskCard.classList.add("is-hidden");
  }
}

// ---------- auth forms ----------

function initAuthForms() {
  const tabBtns = document.querySelectorAll(".tab-btn");
  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabBtns.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      const which = btn.dataset.form;
      loginForm.classList.toggle("is-hidden", which !== "login");
      signupForm.classList.toggle("is-hidden", which !== "signup");
    });
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setError("login", "");
    const fd = new FormData(loginForm);
    try {
      const data = await apiFetch(API_ROUTES.login, {
        method: "POST",
        body: JSON.stringify({ email: fd.get("email"), password: fd.get("password") }),
      });
      const label = data?.user?.name || data?.user?.email || fd.get("email");
      saveSession(data.token, label);
      renderAuthState();
      loadTasks();
    } catch (err) {
      setError("login", err.message);
    }
  });

  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setError("signup", "");
    const fd = new FormData(signupForm);
    try {
      const data = await apiFetch(API_ROUTES.signup, {
        method: "POST",
        body: JSON.stringify({
          name: fd.get("name"),
          email: fd.get("email"),
          password: fd.get("password"),
        }),
      });
      const label = data?.user?.name || fd.get("name");
      saveSession(data.token, label);
      renderAuthState();
      loadTasks();
    } catch (err) {
      setError("signup", err.message);
    }
  });

  document.getElementById("logoutBtn").addEventListener("click", () => {
    clearSession();
    renderAuthState();
  });
}

// ---------- tasks ----------

async function loadTasks() {
  setError("task", "");
  try {
    const tasks = await apiFetch(API_ROUTES.tasks, { method: "GET" });
    renderTasks(Array.isArray(tasks) ? tasks : tasks?.tasks || []);
  } catch (err) {
    setError("task", err.message);
  }
}

function renderTasks(tasks) {
  const list = document.getElementById("taskList");
  const empty = document.getElementById("emptyState");
  list.innerHTML = "";

  if (!tasks.length) {
    empty.classList.remove("is-hidden");
    return;
  }
  empty.classList.add("is-hidden");

  const template = document.getElementById("taskItemTemplate");

  tasks.forEach((task) => {
    const node = template.content.cloneNode(true);
    const li = node.querySelector(".task-item");
    const toggle = node.querySelector(".task-toggle");
    const titleInput = node.querySelector(".task-title-input");
    const descInput = node.querySelector(".task-desc-input");
    const meta = node.querySelector(".task-meta");
    const editBtn = node.querySelector(".task-edit");
    const saveBtn = node.querySelector(".task-save");
    const deleteBtn = node.querySelector(".task-delete");

    li.dataset.id = task.id;
    toggle.checked = !!task.completed;
    li.classList.toggle("is-done", !!task.completed);
    titleInput.value = task.title || "";
    descInput.value = task.description || "";
    titleInput.readOnly = true;
    descInput.readOnly = true;
    meta.textContent = task.id != null ? `#${task.id}` : "";

    toggle.addEventListener("change", async () => {
      try {
        await apiFetch(API_ROUTES.task(task.id), {
          method: "PUT",
          body: JSON.stringify({ completed: toggle.checked }),
        });
        li.classList.toggle("is-done", toggle.checked);
      } catch (err) {
        toggle.checked = !toggle.checked;
        setError("task", err.message);
      }
    });

    editBtn.addEventListener("click", () => {
      const startEditing = titleInput.readOnly; // was read-only, so this click starts editing
      titleInput.readOnly = !startEditing;
      descInput.readOnly = !startEditing;
      saveBtn.classList.toggle("is-hidden", !startEditing);
      if (startEditing) titleInput.focus();
    });

    saveBtn.addEventListener("click", async () => {
      try {
        await apiFetch(API_ROUTES.task(task.id), {
          method: "PUT",
          body: JSON.stringify({ title: titleInput.value, description: descInput.value }),
        });
        titleInput.readOnly = true;
        descInput.readOnly = true;
        saveBtn.classList.add("is-hidden");
      } catch (err) {
        setError("task", err.message);
      }
    });

    deleteBtn.addEventListener("click", async () => {
      if (!confirm("Delete this task?")) return;
      try {
        await apiFetch(API_ROUTES.task(task.id), { method: "DELETE" });
        li.remove();
        if (!list.children.length) document.getElementById("emptyState").classList.remove("is-hidden");
      } catch (err) {
        setError("task", err.message);
      }
    });

    list.appendChild(node);
  });
}

function initNewTaskForm() {
  const form = document.getElementById("newTaskForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setError("task", "");
    const fd = new FormData(form);
    try {
      await apiFetch(API_ROUTES.tasks, {
        method: "POST",
        body: JSON.stringify({ title: fd.get("title"), description: fd.get("description") }),
      });
      form.reset();
      loadTasks();
    } catch (err) {
      setError("task", err.message);
    }
  });
}

// ---------- boot ----------

document.addEventListener("DOMContentLoaded", () => {
  initStackSwitcher();
  initAuthForms();
  initNewTaskForm();
  loadSessionForStack();
  refreshConnectionStatus();
});