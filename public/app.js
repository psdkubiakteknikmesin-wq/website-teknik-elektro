/* SIPREL — interaksi klien tanpa dependensi */
(function () {
  'use strict';

  const toastEl = document.getElementById('toast');
  let toastTimer = null;

  function toast(msg, ms) {
    if (!toastEl) {
      window.alert(msg);
      return;
    }
    toastEl.textContent = msg;
    toastEl.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-show'), ms || 3200);
  }

  function postJSON(url) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
      body: '{}',
      credentials: 'same-origin',
    }).then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.pesan || 'Permintaan gagal.');
      return data;
    });
  }

  /* menu mobile */
  document.querySelectorAll('[data-menu]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nav = document.querySelector('.site-nav');
      const sidebar = document.getElementById('sidebar');
      if (nav) nav.classList.toggle('is-open');
      if (sidebar) sidebar.classList.toggle('is-open');
    });
  });

  /* tampilkan kata sandi */
  document.querySelectorAll('[data-reveal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = btn.parentElement.querySelector('input');
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
    });
  });

  /* salin ke papan klip */
  document.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const text = btn.getAttribute('data-copy') || '';
      try {
        await navigator.clipboard.writeText(text);
        toast('Berhasil disalin ke papan klip.');
      } catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand('copy');
          toast('Berhasil disalin ke papan klip.');
        } catch {
          toast('Gagal menyalin. Salin secara manual.');
        }
        ta.remove();
      }
    });
  });

  /* cetak notifikasi + catat waktu cetak */
  document.querySelectorAll('[data-print-notif]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const token = btn.getAttribute('data-token');
      if (token) {
        // catat di latar belakang, jangan menunda dialog cetak
        postJSON('/api/terima/' + encodeURIComponent(token) + '/cetak').catch(() => {});
      }
      window.print();
    });
  });

  /* kirim WhatsApp */
  document.querySelectorAll('[data-wa]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const token = btn.getAttribute('data-token');
      if (!token) return;
      const label = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = 'Menyiapkan pesan…';
      // siapkan tab kosong lebih dulu agar tidak diblokir popup blocker
      let tab = null;
      try {
        tab = window.open('', '_blank');
      } catch {
        tab = null;
      }
      try {
        const data = await postJSON('/api/terima/' + encodeURIComponent(token) + '/kirim');
        if (data.mode === 'tautan' && data.link) {
          if (tab) tab.location.href = data.link;
          else window.open(data.link, '_blank', 'noopener');
          toast('WhatsApp dibuka di tab baru. Tekan kirim untuk mengirim pesan.');
        } else {
          if (tab) tab.close();
          if (data.ok) toast('Notifikasi WhatsApp berhasil dikirim.');
          else toast(data.pesan || 'Gagal mengirim WhatsApp.');
        }
      } catch (err) {
        if (tab) tab.close();
        toast(err.message || 'Gagal mengirim WhatsApp.');
      } finally {
        btn.disabled = false;
        btn.innerHTML = label;
      }
    });
  });

  /* tombol cetak umum */
  document.querySelectorAll('[data-print]').forEach((btn) => {
    btn.addEventListener('click', () => window.print());
  });
})();
