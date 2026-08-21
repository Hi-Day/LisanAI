export function showToast(message, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = type === 'error' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️';
  
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
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

// Simple wrapper to replace alert
window.appAlert = function(msg) {
  showToast(msg, 'error');
};

window.appSuccess = function(msg) {
  showToast(msg, 'success');
};
