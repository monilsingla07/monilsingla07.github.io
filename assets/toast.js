// assets/toast.js — shared feedback components (UX-046).
//
//   toast({ message, kind, duration })            kind: success | info | error | warning
//   confirmDialog({ title, body, confirmLabel, cancelLabel }) -> Promise<boolean>
//
// These replace native alert()/confirm() on customer pages. Always `await`
// confirmDialog:  if (await confirmDialog({...})) { ... }
import { openTrap } from "./a11y.js";
import { icon } from "./icons.js";

const KIND_ICON = { success: "check", info: "info", error: "error", warning: "warning" };

function toastHost() {
  let host = document.getElementById("toastHost");
  if (!host) {
    host = document.createElement("div");
    host.id = "toastHost";
    host.className = "toast-host";
    document.body.appendChild(host);
  }
  return host;
}

// toast() returns dismiss(). `icon: false` gives the plain (icon-less) toast
// used by showToast() in ui.js. Text is set via textContent (never innerHTML).
export function toast({ message = "", kind = "info", duration = 4500, actionLabel = "", onAction = null, icon: withIcon = true } = {}) {
  if (!KIND_ICON[kind]) kind = "info";
  const el = document.createElement("div");
  el.className = "toast toast-" + kind;
  if (withIcon) {
    const ic = document.createElement("span");
    ic.className = "toast-icon";
    ic.innerHTML = icon(KIND_ICON[kind], { size: 20 });
    el.appendChild(ic);
  }
  const text = document.createElement("span");
  text.className = "toast-msg";
  text.textContent = String(message ?? "");
  el.appendChild(text);

  let timer = null;
  const dismiss = () => { clearTimeout(timer); el.remove(); };
  if (actionLabel) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "toast-action";
    b.textContent = actionLabel;
    b.addEventListener("click", () => { dismiss(); try { onAction && onAction(); } catch (_) {} });
    el.appendChild(b);
  }
  if (!(duration > 0)) {
    // Persistent toast: must be dismissable.
    const x = document.createElement("button");
    x.type = "button";
    x.className = "toast-close";
    x.setAttribute("aria-label", "Dismiss");
    x.innerHTML = icon("close", { size: 18 });
    x.addEventListener("click", dismiss);
    el.appendChild(x);
  }
  toastHost().appendChild(el);

  const spoken = String(message ?? "") + (actionLabel ? ". " + actionLabel + " available." : "");
  if (typeof window.announce === "function") window.announce(spoken);
  else el.setAttribute("role", kind === "error" ? "alert" : "status");
  if (duration > 0) timer = setTimeout(dismiss, duration);
  return dismiss;
}

// confirmDialog() resolves true (confirm) or false (cancel / Esc / backdrop).
// role=alertdialog + aria-modal, focus trapped, focus returns to the opener.
// The confirm button is focused by default (Enter confirms); pass
// focus: "cancel" for irreversible actions. `message` is accepted as an
// alias of `body` for older call sites.
export function confirmDialog({ title = "Are you sure?", body, message = "", confirmLabel = "Confirm", cancelLabel = "Cancel", focus = "confirm" } = {}) {
  return new Promise((resolve) => {
    const bg = document.createElement("div");
    bg.className = "dlg-bg";
    const uid = "dlg" + Math.random().toString(36).slice(2, 8);
    bg.innerHTML = `
      <div class="dlg" role="alertdialog" aria-modal="true" aria-labelledby="${uid}t" aria-describedby="${uid}d">
        <h2 id="${uid}t" class="dlg-title"></h2>
        <p id="${uid}d" class="dlg-text"></p>
        <div class="dlg-actions">
          <button type="button" class="btn secondary" data-act="cancel"></button>
          <button type="button" class="btn" data-act="ok"></button>
        </div>
      </div>`;
    bg.querySelector(".dlg-title").textContent = title;
    bg.querySelector(".dlg-text").textContent = body ?? message;
    const cancelBtn = bg.querySelector('[data-act="cancel"]');
    const okBtn = bg.querySelector('[data-act="ok"]');
    cancelBtn.textContent = cancelLabel;
    okBtn.textContent = confirmLabel;
    document.body.appendChild(bg);

    let done = false;
    let release = () => {};
    const finish = (val) => {
      if (done) return;
      done = true;
      release();
      bg.remove();
      resolve(val);
    };
    release = openTrap(bg.querySelector(".dlg"), {
      onEscape: () => finish(false),
      initialFocus: focus === "cancel" ? cancelBtn : okBtn,
    });
    bg.addEventListener("click", (e) => { if (e.target === bg) finish(false); });
    cancelBtn.addEventListener("click", () => finish(false));
    okBtn.addEventListener("click", () => finish(true));
  });
}
