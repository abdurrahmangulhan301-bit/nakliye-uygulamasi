import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { createClient } from '@supabase/supabase-js';

// Supabase bağlantısı (Render Environment Variables üzerinden otomatik çekilir)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

console.log("⏳ Bot başlatılıyor, lütfen bekleyin...");

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process', // Render 512MB RAM sınırını aşmamak için kritik
            '--disable-gpu'
        ]
    }
});

client.on('qr', (qr) => {
    console.log('📱 WhatsApp QR Kodu oluşturuldu, lütfen terminalden taratın:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ Bot başarıyla bağlandı ve aktif!');
});

client.on('message', async (msg) => {
    try {
        // Gelen mesajları işleme veya Supabase'e kaydetme mantığınız buraya gelebilir
        console.log(`Mesaj alındı: ${msg.body}`);
    } catch (err) {
        console.log('⚠️ Mesaj işlenirken hata:', err.message);
    }
});

client.on('auth_failure', (msg) => {
    console.error('⚠️ Kimlik doğrulama hatası:', msg);
});

client.on('disconnected', (reason) => {
    console.log('⚠️ Bot bağlantısı kesildi:', reason);
});

// Anlık kopma ve frame hatalarını yakalayıp botun çökmesini önleyen koruma
process.on('uncaughtException', (err) => {
    console.log('⚠️ Geçici Hata Yakalandı:', err.message);
});

client.initialize().catch(err => {
    console.log('⚠️ Başlatma Hatası Yakalandı:', err.message);
});