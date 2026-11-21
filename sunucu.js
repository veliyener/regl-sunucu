// Regl uygulamasının sunucusu.
// Şimdilik tek görevi: özel kullanıcıları tanımak.
// Hiçbir ek paket kullanmaz, Node.js'in kendi araçlarıyla çalışır.

import { createServer } from 'node:http';
import { createHash } from 'node:crypto';

// Uygulamadaki ile birebir aynı sadeleştirme:
// "ÇİSLİ", "çisli" ve "Cisli" aynı kabul edilir.
function sadelestir(metin) {
  return metin
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\u0307/g, '')
    .replace(/[İIı]/g, 'i')
    .replace(/[Çç]/g, 'c')
    .replace(/[Şş]/g, 's')
    .replace(/[Ğğ]/g, 'g')
    .replace(/[Öö]/g, 'o')
    .replace(/[Üü]/g, 'u')
    .toLowerCase();
}

function parmakIzi(metin) {
  return createHash('sha256').update(metin).digest('hex');
}

// Özel kişiler Render panelindeki OZEL_KISILER ayarından okunur.
// Biçim: isim1,isim2|YYYY-AA-GG ; isim|YYYY-AA-GG
// Örnek: Çisli,Çisli Melek|2001-09-21;Esma|2000-05-14
// Virgülle ayrılan isimlerin hepsi tanınır, uygulama da kişiye bu isimlerle hitap eder.
// Kod içinde hiçbir isim veya tarih yazmaz.
const ozelKisiler = new Map(); // parmak izi -> hitap isimleri
for (const kayit of (process.env.OZEL_KISILER ?? '').split(';')) {
  if (!kayit.includes('|')) continue;
  const [isimler, tarih] = kayit.split('|');
  const hitaplar = isimler.split(',').map((i) => i.trim()).filter(Boolean);
  for (const isim of hitaplar) {
    ozelKisiler.set(parmakIzi(`${sadelestir(isim)}|${tarih.trim()}`), hitaplar);
  }
}

function cevapla(res, durum, veri) {
  res.writeHead(durum, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(veri));
}

const sunucu = createServer((req, res) => {
  // Uygulama açılınca sunucuyu uyandırmak için çağrılır
  if (req.method === 'GET' && req.url === '/saglik') {
    return cevapla(res, 200, { durum: 'ayakta' });
  }

  // Uygulama isim ve tarihi değil, sadece parmak izini gönderir
  if (req.method === 'POST' && req.url === '/ozel-kontrol') {
    let govde = '';
    req.on('data', (parca) => {
      govde += parca;
      if (govde.length > 1000) req.destroy(); // aşırı büyük istekleri reddet
    });
    req.on('end', () => {
      try {
        const { iz } = JSON.parse(govde);
        const hitaplar = typeof iz === 'string' ? ozelKisiler.get(iz) : undefined;
        cevapla(res, 200, hitaplar ? { ozel: true, hitaplar } : { ozel: false });
      } catch {
        cevapla(res, 400, { hata: 'Geçersiz istek' });
      }
    });
    return;
  }

  cevapla(res, 404, { hata: 'Bulunamadı' });
});

const port = process.env.PORT || 3000;
sunucu.listen(port, () => {
  console.log(`Sunucu ${port} portunda çalışıyor. Tanınan özel isim sayısı: ${ozelKisiler.size}`);
});
