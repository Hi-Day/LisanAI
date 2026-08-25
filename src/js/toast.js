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
    <span class="toast-message" style="flex: 1;">${message}</span>
    <button class="toast-close" aria-label="Tutup notifikasi" title="Tutup">&times;</button>
  `;

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
