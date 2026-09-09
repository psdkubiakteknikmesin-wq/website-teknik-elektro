// ===============================
// PENGATURAN WEBSITE
// ===============================
// Ganti URL di bawah dengan link Google Apps Script/KRS,
// Google Drive, YouTube, WhatsApp, atau sistem lain milik Anda.

const LINKS = {
  krs: "https://docs.google.com/document/d/1pX8olu3GH4E2G9Oo0eq5W7nZlzU0LCNS/edit?usp=sharing&ouid=115644105546172445736&rtpof=true&sd=true",
  semesterAntara: "",
  form Krs: "  ",
  suratKrsTerlambat: "",
  jadwal: "",
  kalender: "",
  youtube: "fakultas teknik uncen",
  whatsapp: "081245362209",
  email: "bondansangadji7@gmail.com"
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
