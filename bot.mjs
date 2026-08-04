import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcodeTerminal from 'qrcode-terminal';
import { createClient } from '@supabase/supabase-js';
import express from 'express';
import qrcode from 'qrcode';

const app = express();
const PORT = process.env.PORT || 10000;

let qrCodeData = '';

app.get('/', async (req, res) => {
    if (!qrCodeData) {
        return res.send(`
            <html>
                <body style="text-align:center; font-family:sans-serif; margin-top:50px; background:#f4f7f6;">
                    <h2>⏳ QR Kod bekleniyor veya bot zaten bağlı!</h2>
                    <p>Lütfen birkaç saniye sonra sayfayı yenileyin.</p>
                </body>
            </html>
        `);
    }
    try {
        const url = await qrcode.toDataURL(qrCodeData);
        res.send(`
            <html>
                <head>
                    <title>WhatsApp Bot QR Kod</title>
                    <meta http-equiv="refresh" content="10">
                </head>
                <body style="text-align:center; font-family:sans-serif; margin-top:40px; background:#f4f7f6;">
                    <div style="background:white; padding:30px; display:inline-block; border-radius:10px; box-shadow:0 4px 10px rgba(0,0,0,0.1);">
                        <h2>WhatsApp Bot QR Kodu</h2>
                        <p>Telefonunuzdan WhatsApp'ı açın ve bu kodu taratın.</p>
                        <img src="${url}" alt="QR Code" style="width:320px;height:320px;" />
                        <p style="color: gray; font-size: 12px; margin-top: 15px;">Bu sayfa yeni QR kod için her 10 saniyede bir güncellenir.</p>
                    </div>
                </body>
            </html>
        `);
    } catch (err) {
        res.send('QR kod oluşturulurken hata oluştu.');
    }
});

app.listen(PORT, () => {
    console.log(`🌐 Web sunucu ${PORT} portunda başlatıldı.`);
});

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
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--disable-extensions'
        ]
    }
});

client.on('qr', (qr) => {
    qrCodeData = qr;
    console.log('📱 QR Kod alındı! Tarayıcıdan şu adrese girerek taratabilirsiniz:');
    console.log('👉 https://nakliye-uygulamasi.onrender.com');
    qrcodeTerminal.generate(qr, { small: true });
});

client.on('authenticated', () => {
    console.log('🔑 WhatsApp oturumu başarıyla doğrulandı (Authenticated)!');
});

client.on('auth_failure', (msg) => {
    console.error('❌ Kimlik doğrulama başarısız oldu:', msg);
});

client.on('ready', () => {
    qrCodeData = ''; 
    console.log('✅ Bot başarıyla bağlandı ve aktif! Grup ilanları dinleniyor...');
});

// Gelen tüm mesajları (gruplar dahil) yakalayıp Supabase'e kaydetme
client.on('message', async (msg) => {
    try {
        console.log(`📩 Yeni mesaj yakalandı! Gönderen: ${msg.from} | İçerik: ${msg.body}`);

        const { data, error } = await supabase
            .from('ilanlar')
            .insert([
                { 
                    icerik: msg.body, 
                    gonderen: msg.from 
                }
            ]);

        if (error) {
            console.error('❌ Supabase Kayıt Hatası:', error.message);
        } else {
            console.log('✅ İlan başarıyla Supabase veritabanına kaydedildi!');
        }

    } catch (err) {
        console.log('⚠️ Mesaj işlenirken hata:', err.message);
    }
});

client.initialize().catch(err => {
    console.log('⚠️ Başlatma Hatası Yakalandı:', err);
});

process.on('uncaughtException', (err) => {
    console.log('⚠️ Yakalanmayan İstisna:', err);
});

process.on('unhandledRejection', (reason) => {
    console.log('⚠️ Yakalanmayan Promise Reddi:', reason);
});