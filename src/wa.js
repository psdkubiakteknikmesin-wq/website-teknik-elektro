import { normalisasiWA, nowISO } from './util.js';
import { db, catatWA, catatLog } from './db.js';

export function waLink(nomor, pesan) {
  const n = normalisasiWA(nomor);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(pesan)}` : '';
}

/**
 * Kirim WhatsApp melalui gateway yang dikonfigurasi admin.
 * Bila gateway belum diatur, kembalikan tautan wa.me agar tetap bisa
 * dikirim manual dari perangkat admin (tanpa biaya pihak ketiga).
 */
export async function kirimWA({ nomor, pesan, settings, letterId = null }) {
  const target = normalisasiWA(nomor);
  if (!target) {
    return { ok: false, mode: 'tidak-ada-nomor', pesan: 'Nomor WhatsApp penerima belum diisi.' };
  }
  const provider = String(settings.wa_provider || '').toLowerCase().trim();
  const token = String(settings.wa_token || '').trim();
  const tautan = waLink(target, pesan);

  if (!provider || !token) {
    catatWA(letterId, target, 'tautan', provider || 'wa.me', pesan, 'Gateway belum dikonfigurasi — tautan wa.me dibuat.');
    if (letterId) {
      db.prepare("UPDATE letters SET wa_status = 'tautan', wa_at = ? WHERE id = ?").run(nowISO(), letterId);
    }
    return {
      ok: true,
      mode: 'tautan',
      link: tautan,
      pesan: 'Gateway WhatsApp belum dikonfigurasi. Pesan disiapkan sebagai tautan WhatsApp — buka lalu tekan kirim.',
    };
  }

  let url = '';
  let init = {};
  try {
    if (provider === 'fonnte') {
      url = 'https://api.fonnte.com/send';
      const body = new URLSearchParams({ target, message: pesan, countryCode: '62' });
      init = { method: 'POST', headers: { Authorization: token }, body };
    } else if (provider === 'wablas') {
      url = String(settings.wa_api_url || 'https://console.wablas.com/api/send-message').trim();
      const body = new URLSearchParams({ phone: target, message: pesan });
      init = { method: 'POST', headers: { Authorization: token }, body };
    } else {
      url = String(settings.wa_api_url || '').replaceAll('{token}', token).replaceAll('{target}', target);
      if (!url) throw new Error('URL API WhatsApp (custom) belum diisi pada Pengaturan.');
      init = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({
          target, phone: target, message: pesan, token,
          sender: settings.wa_sender || '', countryCode: '62',
        }),
      };
    }
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(20000) });
    const text = (await res.text()).slice(0, 800);
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* respons bukan JSON */
    }
    const gagal =
      !res.ok ||
      (parsed && (parsed.status === false || parsed.status === 'false' || parsed.success === false));
    const status = gagal ? 'gagal' : 'terkirim';
    catatWA(letterId, target, status, provider, pesan, text);
    if (letterId) {
      db.prepare('UPDATE letters SET wa_status = ?, wa_at = ? WHERE id = ?').run(status, nowISO(), letterId);
    }
    catatLog('sistem', 'kirim_wa', 'letter', letterId, `${provider} → ${target}: ${status}`);
    return {
      ok: !gagal,
      mode: 'gateway',
      link: tautan,
      pesan: gagal
        ? `Gateway ${provider} menolak pengiriman. ${parsed?.reason || parsed?.message || text || ''}`.trim()
        : `Pesan WhatsApp terkirim otomatis melalui ${provider}.`,
    };
  } catch (err) {
    const pesan2 = err?.message || 'Gagal menghubungi gateway WhatsApp.';
    catatWA(letterId, target, 'gagal', provider, pesan, pesan2);
    if (letterId) {
      db.prepare("UPDATE letters SET wa_status = 'gagal', wa_at = ? WHERE id = ?").run(nowISO(), letterId);
    }
    return { ok: false, mode: 'error', link: tautan, pesan: `Gagal mengirim WhatsApp: ${pesan2}` };
  }
}
