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
      // Fungsi untuk mencoba beberapa proxy CORS. Mengembalikan teks HTML jika salah satu berhasil.
      async function fetchViaProxies(targetUrl) {
        // Daftar proxy. Kita mencoba satu per satu sampai ada yang berhasil.
        const proxies = [
          (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
          (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
          (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
        ];
        for (const buildUrl of proxies) {
          try {
            const testUrl = buildUrl(targetUrl);
            const resp = await fetch(testUrl);
            if (resp.ok) {
              // Jika endpoint /get digunakan, respons berbentuk JSON dengan properti `contents`.
              const ct = resp.headers.get('content-type') || '';
              if (ct.includes('application/json')) {
                const data = await resp.json();
                if (data && data.contents) return data.contents;
              } else {
                return await resp.text();
              }
            }
          } catch (e) {
            // Lanjutkan ke proxy berikutnya
          }
        }
        throw new Error('Tidak dapat mengambil data dari URL target melalui proxy yang tersedia.');
      }
      // Ambil HTML dari URL dengan mencoba beberapa proxy
      const htmlText = await fetchViaProxies(url);
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, 'text/html');

      // Ekstrak elemen yang relevan untuk SEO
      const title = doc.querySelector('title')?.textContent?.trim() || '';
      const metaDesc = doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || '';
      const canonicalLink = doc.querySelector('link[rel="canonical"]')?.getAttribute('href')?.trim() || '';

      // Kumpulkan heading H1
      const h1Elements = Array.from(doc.querySelectorAll('h1'));
      const h1Texts = h1Elements.map((el) => el.textContent.trim()).filter((t) => t);

      // Kumpulkan gambar dan hitung alt text
      const images = Array.from(doc.querySelectorAll('img'));
      const totalImages = images.length;
      const altMissing = images.filter((img) => !img.getAttribute('alt') || img.getAttribute('alt').trim() === '').length;

      // Kumpulkan semua link (anchor dengan atribut href)
      const allLinks = Array.from(doc.querySelectorAll('a[href]'));
      let internalLinks = 0;
      let externalLinks = 0;
      const brokenLinks = [];
      try {
        const targetHost = new URL(url).host;
        for (const a of allLinks) {
          const href = a.getAttribute('href');
          if (!href) {
            brokenLinks.push('(atribut href kosong)');
            continue;
          }
          const trimmedHref = href.trim();
          // Abaikan anchor internal (#), javascript, atau mailto – ini dianggap bukan link broken tetapi internal
          if (trimmedHref.startsWith('#') || trimmedHref.startsWith('javascript:') || trimmedHref.startsWith('mailto:')) {
            internalLinks++;
            continue;
          }
          // Resolusi URL relatif menjadi absolut berdasarkan URL yang dianalisis
          let resolvedHref;
          try {
            resolvedHref = new URL(trimmedHref, url).href;
          } catch (e) {
            brokenLinks.push(trimmedHref);
            continue;
          }
          try {
            const linkUrl = new URL(resolvedHref);
            if (linkUrl.host === targetHost) {
              internalLinks++;
            } else {
              externalLinks++;
            }
          } catch (e) {
            // Jika gagal mengurai host, anggap internal
            internalLinks++;
          }
        }
      } catch (err) {
        // Jika gagal mengurai URL asal, asumsikan semua link sebagai eksternal
        externalLinks = allLinks.length;
      }

      // Periksa link broken secara asinkron dengan memanggil CORS proxy (hanya untuk link eksternal dan internal penuh)
      const checkBroken = async () => {
        const testLinks = allLinks.slice(0, 10); // batasi jumlah link yang diperiksa untuk performa
        for (const a of testLinks) {
          const href = a.getAttribute('href');
          if (!href) continue;
          const trimmedHref = href.trim();
          if (trimmedHref.startsWith('#') || trimmedHref.startsWith('javascript:') || trimmedHref.startsWith('mailto:')) continue;
          let fullUrl;
          try {
            fullUrl = new URL(trimmedHref, url).href;
          } catch (e) {
            // Jika tak bisa diresolve, sudah ditandai broken
            continue;
          }
          try {
            // gunakan endpoint proxy untuk mencoba mengambil konten; jika gagal, tandai sebagai broken
            const testProxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(fullUrl);
            const linkResp = await fetch(testProxyUrl, { method: 'GET' });
            if (!linkResp.ok) {
              brokenLinks.push(fullUrl);
            }
          } catch (e) {
            brokenLinks.push(fullUrl);
          }
        }
      };

      // Buat daftar saran
      let suggestions = [];
      if (!title) suggestions.push('Tambahkan title tag yang deskriptif.');
      if (!metaDesc) suggestions.push('Tambahkan meta description yang ringkas.');
      if (!canonicalLink) suggestions.push('Tambahkan canonical tag untuk menghindari duplikasi konten.');
      if (h1Texts.length === 0) suggestions.push('Tidak ditemukan H1; pastikan setiap halaman memiliki satu H1.');
      if (altMissing > 0) suggestions.push(`${altMissing} gambar tidak memiliki alt text; tambahkan alt text deskriptif.`);

      // Jalankan pemeriksaan link broken (tidak blocking tampilan awal)
      checkBroken().then(() => {
        // Setelah pemeriksaan selesai, tambahkan informasi link broken ke tampilan jika ada
        if (brokenLinks.length > 0) {
          const brokenList = brokenLinks.map((b) => `<li>${b}</li>`).join('');
          const brokenSection = `\n<p><strong>Link yang terdeteksi bermasalah (sample):</strong></p><ul>${brokenList}</ul>`;
          resultsDiv.innerHTML += brokenSection;
          if (!suggestions.some((s) => s.includes('perbaiki link'))) {
            suggestions.push('Beberapa link bermasalah ditemukan; periksa dan perbaiki link yang rusak.');
          }
        }
        // Perbarui daftar saran setelah pemeriksaan selesai
        const suggestionHtml = suggestions.length > 0
          ? `<h4>Saran:</h4><ul>${suggestions.map((s) => `<li>${s}</li>`).join('')}</ul>`
          : '<p>Tidak ada saran khusus. Situs ini sudah memenuhi elemen dasar SEO.</p>';
        document.getElementById('suggestions-container').innerHTML = suggestionHtml;
      });

      // Render awal hasil analisis (tanpa menunggu pemeriksaan broken link selesai)
      resultsDiv.innerHTML = `
        <h3>Hasil Analisis</h3>
        <p><strong>Judul Halaman:</strong> ${title || 'Tidak ditemukan'}</p>
        <p><strong>Deskripsi Meta:</strong> ${metaDesc || 'Tidak ditemukan'}</p>
        <p><strong>Tag Canonical:</strong> ${canonicalLink || 'Tidak ditemukan'}</p>
        <p><strong>Jumlah H1:</strong> ${h1Texts.length} ${h1Texts.length ? '(' + h1Texts.join(', ') + ')' : ''}</p>
        <p><strong>Gambar dengan alt text:</strong> ${totalImages - altMissing} dari ${totalImages}</p>
        <p><strong>Link Internal:</strong> ${internalLinks}</p>
        <p><strong>Link Eksternal:</strong> ${externalLinks}</p>
        <div id="suggestions-container"></div>
      `;
    } catch (error) {
      resultsDiv.innerHTML = `<p class="error">Terjadi kesalahan: ${error.message}</p>`;
    }
  });
});