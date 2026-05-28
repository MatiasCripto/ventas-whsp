// Upload product images to Supabase Storage
// Run: node scripts/upload-images.mjs

const { createClient } = await import('@supabase/supabase-js');

const SUPABASE_URL = 'https://bkzvfzrulohalmexfpnb.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrenZmenJ1bG9oYWxtZXhmcG5iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTc0ODYxMCwiZXhwIjoyMDk1MzI0NjEwfQ.yHsKaQE9qr2sDTB3wgb5EMmacDA0XaK3-Br-CIuzJOs';

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BUCKET = 'product-images';
const ORG_ID = '11111111-1111-1111-1111-111111111111';

const PRODUCTS = [
  { id: 'bbb11111-0000-0000-0000-000000000001', seed: 'tshirt', label: 'Remera Básica' },
  { id: 'bbb11111-0000-0000-0000-000000000002', seed: 'fashion', label: 'Remera Oversize' },
  { id: 'bbb11111-0000-0000-0000-000000000003', seed: 'jeans', label: 'Jean Clásico' },
  { id: 'bbb11111-0000-0000-0000-000000000004', seed: 'sweatpants', label: 'Jogging Deportivo' },
  { id: 'bbb11111-0000-0000-0000-000000000005', seed: 'hoodie', label: 'Buzo Canguro' },
  { id: 'bbb11111-0000-0000-0000-000000000006', seed: 'jacket', label: 'Campera Rompevientos' },
  { id: 'bbb11111-0000-0000-0000-000000000007', seed: 'shorts', label: 'Short Deportivo' },
  { id: 'bbb11111-0000-0000-0000-000000000008', seed: 'underwear', label: 'Boxer Algodón' },
  { id: 'bbb11111-0000-0000-0000-000000000009', seed: 'cap', label: 'Gorra Visera Plana' },
  { id: 'bbb11111-0000-0000-0000-000000000010', seed: 'backpack', label: 'Mochila Urbana' },
  { id: 'bbb11111-0000-0000-0000-000000000011', seed: 'sneakers', label: 'Zapatillas Urbanas' },
  { id: 'bbb11111-0000-0000-0000-000000000012', seed: 'socks', label: 'Medias Algodón' },
];

async function downloadImage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  return await res.arrayBuffer();
}

async function main() {
  console.log('Starting image upload for', PRODUCTS.length, 'products...\n');

  for (const p of PRODUCTS) {
    try {
      process.stdout.write(`[${p.label}] Downloading... `);
      const url = `https://picsum.photos/seed/${p.seed}/400/400`;
      const buffer = await downloadImage(url);
      const blob = new Blob([buffer], { type: 'image/jpeg' });
      process.stdout.write(`(${buffer.byteLength} bytes) Uploading... `);

      const filePath = `${ORG_ID}/${p.id}/${p.seed}.jpg`;
      const { error: uploadError } = await sb.storage.from(BUCKET).upload(filePath, blob, {
        contentType: 'image/jpeg',
        upsert: true,
      });
      if (uploadError) { process.stdout.write(`UPLOAD ERR: ${uploadError.message} `); continue; }

      const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(filePath);
      process.stdout.write(`OK `);

      const { error: updateError } = await sb.from('products')
        .update({ images: [urlData.publicUrl] })
        .eq('id', p.id);
      if (updateError) { process.stdout.write(`UPDATE ERR: ${updateError.message} `); continue; }

      console.log(`✓ ${urlData.publicUrl}`);
    } catch (err) {
      console.error(`✗ ${p.label}: ${err.message}`);
    }
  }

  console.log('\nDone!');
}

main().catch(console.error);
