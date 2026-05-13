import { initApp } from "./js/main.js";

initApp().catch((error) => {
  console.error(error);
  alert(`Aplikasi gagal dijalankan: ${error.message}`);
});
