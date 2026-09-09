// ===============================
// PENGATURAN WEBSITE
// ===============================
// Ganti URL di bawah dengan link Google Apps Script/KRS,
// Google Drive, YouTube, WhatsApp, atau sistem lain milik Anda.

const LINKS = {
  krs: "",
  semesterAntara: "",
  formKrs: "",
  suratKrsTerlambat: "",
  jadwal: "",
  kalender: "",
  youtube: "",
  whatsapp: "",
  email: ""
};

document.getElementById("year").textContent = new Date().getFullYear();

const menuToggle = document.getElementById("menuToggle");
const navMenu = document.getElementById("navMenu");

menuToggle.addEventListener("click", () => {
  navMenu.classList.toggle("open");
});

document.querySelectorAll("nav a").forEach(link => {
  link.addEventListener("click", () => navMenu.classList.remove("open"));
});

function showMessage(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3500);
}

// Jika URL layanan sudah diisi, fungsi ini dapat dipakai
// untuk membuka halaman eksternal.
function openLink(name) {
  const url = LINKS[name];
  if (!url) {
    showMessage("Link layanan belum diatur. Silakan isi LINKS di script.js.");
    return false;
  }
  window.open(url, "_blank", "noopener,noreferrer");
  return false;
}
