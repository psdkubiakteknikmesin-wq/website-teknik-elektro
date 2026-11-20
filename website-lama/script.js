// ==========================================
// WEBSITE TEKNIK ELEKTRO
// FAKULTAS TEKNIK - UNIVERSITAS CENDERAWASIH
// ==========================================

// ==========================================
// PENGATURAN LINK WEBSITE
// ==========================================

const LINKS = {

  // KRS ONLINE
  krs: "https://script.google.com/macros/s/AKfycbzm08h_aLppEWd4X-odnhsUse5C0KYQxzMquE1QrsXs3jW3cCn6v2_hgMVaDmiCVap2VA/exec",

  // SEMESTER ANTARA
  semesterAntara: "",

  // DOKUMEN
  formKrs: "https://docs.google.com/document/d/1pX8olu3GH4E2G9Oo0eq5W7nZlzU0LCNS/export?format=pdf",

  suratKrsTerlambat: "https://docs.google.com/document/d/1uNB5lX0ZcsO98jB4Maqvpmf4Dy5-rjOI/export?format=pdf",

  jadwal: "",
  kalender: "",

  // MEDIA / KONTAK
  youtube: "https://www.youtube.com/@fakultasteknikuncen",
  whatsapp: "081245362209",
  email: "bondansangadji7@gmail.com"
};


// ==========================================
// TAHUN OTOMATIS
// ==========================================

const yearElement = document.getElementById("year");

if (yearElement) {
  yearElement.textContent = new Date().getFullYear();
}


// ==========================================
// MENU MOBILE
// ==========================================

const menuToggle = document.getElementById("menuToggle");
const navMenu = document.getElementById("navMenu");

if (menuToggle && navMenu) {

  menuToggle.addEventListener("click", function () {
    navMenu.classList.toggle("open");
  });

}


// ==========================================
// TUTUP MENU SETELAH KLIK
// ==========================================

document.querySelectorAll("nav a").forEach(function (link) {

  link.addEventListener("click", function () {

    if (navMenu) {
      navMenu.classList.remove("open");
    }

  });

});


// ==========================================
// NOTIFIKASI
// ==========================================

function showMessage(message) {

  const toast = document.getElementById("toast");

  if (!toast) {
    alert(message);
    return;
  }

  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(function () {
    toast.classList.remove("show");
  }, 3500);

}


// ==========================================
// MEMBUKA LINK
// ==========================================

function openLink(name) {

  const url = LINKS[name];

  if (!url || url.trim() === "") {

    showMessage(
      "Link layanan belum diatur. Silakan tambahkan link pada bagian LINKS di script.js."
    );

    return false;
  }

  window.open(
    url,
    "_blank",
    "noopener,noreferrer"
  );

  return false;
}


// ==========================================
// KRS ONLINE
// ==========================================

document.querySelectorAll(".service").forEach(function (service) {

  const title = service.querySelector("b");

  if (!title) return;

  const text = title.textContent.trim().toLowerCase();

  if (text.includes("krs")) {

    service.onclick = function () {
      return openLink("krs");
    };

  }

  else if (text.includes("semester antara")) {

    service.onclick = function () {
      return openLink("semesterAntara");
    };

  }

  else if (text.includes("dokumen")) {

    service.onclick = function () {

      const target =
        LINKS.formKrs ||
        LINKS.suratKrsTerlambat ||
        LINKS.jadwal ||
        LINKS.kalender;

      if (!target) {

        showMessage(
          "Link dokumen belum diatur."
        );

        return false;
      }

      window.open(
        target,
        "_blank",
        "noopener,noreferrer"
      );

      return false;
    };

  }

  else if (text.includes("hubungi")) {

    service.onclick = function () {

      if (LINKS.whatsapp) {

        window.open(
          LINKS.whatsapp,
          "_blank",
          "noopener,noreferrer"
        );

      }

      else if (LINKS.email) {

        window.location.href =
          "mailto:" + LINKS.email;

      }

      else {

        showMessage(
          "Nomor WhatsApp atau email belum diatur."
        );

      }

      return false;
    };

  }

});


// ==========================================
// MENU DOWNLOAD
// ==========================================

const downloadLinks =
  document.querySelectorAll(".download-list a");

downloadLinks.forEach(function (link) {

  const text =
    link.textContent.toLowerCase();

  if (text.includes("form krs")) {

    link.onclick = function () {
      return openLink("formKrs");
    };

  }

  else if (
    text.includes("surat pernyataan") ||
    text.includes("krs terlambat")
  ) {

    link.onclick = function () {
      return openLink("suratKrsTerlambat");
    };

  }

  else if (text.includes("jadwal")) {

    link.onclick = function () {
      return openLink("jadwal");
    };

  }

  else if (text.includes("kalender")) {

    link.onclick = function () {
      return openLink("kalender");
    };

  }

});


// ==========================================
// YOUTUBE
// ==========================================

const youtubeLinks =
  document.querySelectorAll('a[href*="youtube"]');

youtubeLinks.forEach(function (link) {

  link.onclick = function () {

    if (LINKS.youtube) {

      window.open(
        LINKS.youtube,
        "_blank",
        "noopener,noreferrer"
      );

    }
    else {

      showMessage(
        "Link YouTube belum diatur."
      );

    }

    return false;

  };

});


// ==========================================
// WHATSAPP
// ==========================================

function bukaWhatsApp() {

  if (!LINKS.whatsapp) {

    showMessage(
      "Link WhatsApp belum diatur."
    );

    return false;
  }

  window.open(
    LINKS.whatsapp,
    "_blank",
    "noopener,noreferrer"
  );

  return false;
}


// ==========================================
// EMAIL
// ==========================================

function kirimEmail() {

  if (!LINKS.email) {

    showMessage(
      "Email belum diatur."
    );

    return false;
  }

  window.location.href =
    "mailto:" + LINKS.email;

  return false;
}


// ==========================================
// SELESAI
// ==========================================

console.log(
  "Website Teknik Elektro berhasil dimuat."
);
