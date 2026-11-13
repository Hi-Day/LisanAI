const MAX_TOASTS = 5;

export function showToast(message, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    document.body.appendChild(container);
  }

  // Remove excess toasts
  while (container.children.length >= MAX_TOASTS) {
    const oldest = container.firstElementChild;
    if (oldest) oldest.remove();
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = type === 'error' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️';
  
  // Use 'status' for all toasts to avoid aggressive screen reader interruption;
  // errors still announce via the message content.
  toast.setAttribute('role', 'status');
  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-message"></span>
    <button class="toast-close" aria-label="Tutup notifikasi" title="Tutup">&times;</button>
  `;

  toast.querySelector('.toast-message').textContent = String(message ?? '');
  container.appendChild(toast);

  const removeToast = () => {
    if (toast.classList.contains('fade-out')) return;
    toast.classList.add('fade-out');
    toast.addEventListener('animationend', () => toast.remove());
  };

  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', removeToast);

  setTimeout(removeToast, 5000);
}

/**
 * Custom confirm dialog (replaces native confirm()).
 * Returns a Promise that resolves to true/false.
 */
export function showConfirmDialog(message, title = 'Konfirmasi') {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirmModal');
    if (!modal) {
      resolve(window.confirm(message));
      return;
    }
    const titleEl = document.getElementById('confirmModalTitle');
    const msgEl = document.getElementById('confirmModalMessage');
    const okBtn = document.getElementById('confirmModalOk');
    const cancelBtn = document.getElementById('confirmModalCancel');

    titleEl.textContent = title;
    msgEl.textContent = message;
    modal.classList.remove('hidden');

    const cleanup = () => {
      modal.classList.add('hidden');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      document.removeEventListener('keydown', onKey);
    };

    const onOk = () => { cleanup(); resolve(true); };
    const onCancel = () => { cleanup(); resolve(false); };
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onOk();
    };

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    document.addEventListener('keydown', onKey);
    cancelBtn.focus();
  });
}

/**
 * Form dialog (replaces native prompt()). Each field is validated next to itself.
 * Resolves to { [name]: value } or null when the user cancels.
 * fields: [{ name, label, type: "text" | "number" | "textarea" | "select", value, required, min, max, options }]
 */
export function showFormDialog({ title, description = "", fields = [], okLabel = "Simpan" }) {
  return new Promise((resolve) => {
    const previousFocus = document.activeElement;
    const id = `formDialog${Date.now()}`;
    const overlay = document.createElement("div");
    overlay.className = "confirm-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", `${id}Title`);

    const form = document.createElement("form");
    form.className = "confirm-dialog form-dialog";
    form.noValidate = true;
    const heading = document.createElement("h3");
    heading.id = `${id}Title`;
    heading.textContent = title;
    form.append(heading);
    if (description) {
      const text = document.createElement("p");
      text.textContent = description;
      form.append(text);
    }

    const controls = fields.map((field) => {
      const label = document.createElement("label");
      label.className = "form-dialog-field";
      const caption = document.createElement("span");
      caption.textContent = field.required ? field.label : `${field.label} (opsional)`;
      let control;
      if (field.type === "textarea") {
        control = document.createElement("textarea");
        control.rows = 3;
      } else if (field.type === "select") {
        control = document.createElement("select");
        for (const [value, text] of field.options || []) control.add(new Option(text, value));
      } else {
        control = document.createElement("input");
        control.type = field.type === "number" ? "number" : "text";
        if (field.type === "number") {
          control.min = String(field.min);
          control.max = String(field.max);
          control.step = "1";
          control.inputMode = "numeric";
        }
      }
      control.name = field.name;
      control.value = field.value ?? "";
      const error = document.createElement("small");
      error.className = "form-dialog-error";
      error.id = `${id}-${field.name}-error`;
      error.setAttribute("role", "alert");
      control.setAttribute("aria-describedby", error.id);
      label.append(caption, control, error);
      form.append(label);
      return { field, control, error };
    });

    const actions = document.createElement("div");
    actions.className = "confirm-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "secondary-button";
    cancel.textContent = "Batal";
    const ok = document.createElement("button");
    ok.type = "submit";
    ok.className = "primary-button";
    ok.textContent = okLabel;
    actions.append(cancel, ok);
    form.append(actions);
    overlay.append(form);

    const close = (result) => {
      document.removeEventListener("keydown", onKey, true);
      overlay.remove();
      previousFocus?.focus?.();
      resolve(result);
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        // Only this dialog closes; a result modal underneath stays open.
        event.stopPropagation();
        close(null);
      } else if (event.key === "Tab") {
        const focusable = [...form.querySelectorAll("input, textarea, select, button")];
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const values = {};
      let firstInvalid = null;
      for (const { field, control, error } of controls) {
        const raw = String(control.value).trim();
        let message = "";
        let value = raw;
        if (field.required && !raw) {
          message = `${field.label} wajib diisi.`;
        } else if (field.type === "number" && raw) {
          value = Number(raw);
          if (!Number.isInteger(value) || value < field.min || value > field.max) {
            message = `Masukkan bilangan bulat ${field.min}–${field.max}.`;
          }
        }
        values[field.name] = value;
        error.textContent = message;
        control.setAttribute("aria-invalid", message ? "true" : "false");
        if (message && !firstInvalid) firstInvalid = control;
      }
      if (firstInvalid) { firstInvalid.focus(); return; }
      close(values);
    });
    cancel.addEventListener("click", () => close(null));
    document.addEventListener("keydown", onKey, true);
    document.body.append(overlay);
    (controls[0]?.control || ok).focus();
    controls[0]?.control.select?.();
  });
}

export function showConfirmDialogSync(message, title = 'Konfirmasi') {
  // Synchronous wrapper — uses native confirm() as fallback.
  // Prefer the async version when possible.
  return window.confirm(`${title}\n\n${message}`);
}

// Simple wrapper to replace alert
window.appAlert = function(msg) {
  showToast(msg, 'error');
};

window.appSuccess = function(msg) {
  showToast(msg, 'success');
};
