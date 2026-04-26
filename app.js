/*
 * File JavaScript untuk Asisten SEO Profesional.
 *
 * Fitur utama:
 *  - Mengambil HTML dari URL yang dimasukkan pengguna melalui proxy CORS.
 *  - Mengekstrak informasi dasar seperti judul, deskripsi, heading, gambar,
 *    dan jumlah link.
 *  - Menampilkan hasil serta saran perbaikan jika ditemukan kekurangan.
 */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('analyze-form');
  const urlInput = document.getElementById('url-input');
  const resultsDiv = document.getElementById('results');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const url = urlInput.value.trim();
    if (!url) {
      return;
    }
    // Bersihkan hasil sebelumnya dan tampilkan pesan memuat
    resultsDiv.innerHTML = '<p>Mengambil data...</p>';

    try {
      // Gunakan proxy untuk menghindari pembatasan CORS. API allorigins.win
      // akan mengambil konten dari URL target dan mengembalikannya tanpa
      // memerlukan izin CORS.
      const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url);
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error('Tidak dapat mengambil data. Periksa URL Anda atau coba lagi nanti.');
      }
      const htmlText = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, 'text/html');

      // Ekstrak elemen yang relevan untuk SEO
      const title = doc.querySelector('title')?.textContent?.trim() || '';
      const metaDesc = doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || '';
      const h1Elements = Array.from(doc.querySelectorAll('h1'));
      const h1Texts = h1Elements.map((el) => el.textContent.trim()).filter((t) => t);
      const images = Array.from(doc.querySelectorAll('img'));
      const totalImages = images.length;
      const altMissing = images.filter((img) => !img.getAttribute('alt') || img.getAttribute('alt').trim() === '').length;
      const allLinks = Array.from(doc.querySelectorAll('a[href]'));
      // Hitung link internal dan eksternal berdasarkan host URL yang dianalisis
      let internalLinks = 0;
      let externalLinks = 0;
      try {
        const targetHost = new URL(url).host;
        allLinks.forEach((a) => {
          const href = a.getAttribute('href');
          if (!href) return;
          // Link mulai dengan http/https dianggap absolut. Cek apakah host-nya sama.
          try {
            const linkUrl = new URL(href, url);
            if (linkUrl.host === targetHost) {
              internalLinks++;
            } else {
              externalLinks++;
            }
          } catch (e) {
            // Jika URL tidak valid (misal: anchor #), anggap sebagai internal.
            internalLinks++;
          }
        });
      } catch (err) {
        // Jika gagal mengurai URL, asumsikan semua link sebagai eksternal
        externalLinks = allLinks.length;
      }

      // Tampilkan hasil analisis secara dinamis
      let suggestions = [];
      if (!title) suggestions.push('Tambahkan title tag yang deskriptif.');
      if (!metaDesc) suggestions.push('Tambahkan meta description yang ringkas.');
      if (h1Texts.length === 0) suggestions.push('Tidak ditemukan H1; pastikan setiap halaman memiliki satu H1.');
      if (altMissing > 0) suggestions.push(`${altMissing} gambar tidak memiliki alt text; tambahkan alt text deskriptif.`);

      resultsDiv.innerHTML = `
        <h3>Hasil Analisis</h3>
        <p><strong>Judul Halaman:</strong> ${title || 'Tidak ditemukan'}</p>
        <p><strong>Deskripsi Meta:</strong> ${metaDesc || 'Tidak ditemukan'}</p>
        <p><strong>Jumlah H1:</strong> ${h1Texts.length} ${h1Texts.length ? '(' + h1Texts.join(', ') + ')' : ''}</p>
        <p><strong>Gambar dengan alt text:</strong> ${totalImages - altMissing} dari ${totalImages}</p>
        <p><strong>Link Internal:</strong> ${internalLinks}</p>
        <p><strong>Link Eksternal:</strong> ${externalLinks}</p>
        ${suggestions.length > 0 ? `<h4>Saran:</h4><ul>${suggestions.map((s) => `<li>${s}</li>`).join('')}</ul>` : '<p>Tidak ada saran khusus. Situs ini sudah memenuhi elemen dasar SEO.</p>'}
      `;
    } catch (error) {
      resultsDiv.innerHTML = `<p class="error">Terjadi kesalahan: ${error.message}</p>`;
    }
  });
});