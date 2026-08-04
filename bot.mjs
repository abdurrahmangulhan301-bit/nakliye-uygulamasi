import dotenv from 'dotenv';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ HATA: .env dosyasında SUPABASE_URL veya SUPABASE_KEY tanımlı değil!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('⏳ Bot başlatılıyor, lütfen bekleyin...');

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './whatsapp-session' }),
  restartOnAuthFailure: true,
  puppeteer: {
    headless: true,
    protocolTimeout: 120000,
    bypassCSP: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-extensions'
    ]
  }
});

client.on('qr', (qr) => {
  console.log('\n======================================================');
  console.log('LÜTFEN WHATSAPP UYGULAMANIZDAN AŞAĞIDAKİ QR KODU OKUTUN');
  console.log('======================================================\n');
  qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
  console.log('🔑 WhatsApp Kimlik Doğrulaması Başarılı! Oturum Açılıyor...');
});

client.on('ready', () => {
  console.log('\n======================================================');
  console.log('✅ WhatsApp Botu Başarıyla Bağlandı ve Grupları Dinliyor!');
  console.log('======================================================\n');
});

client.on('message', async (msg) => {
  try {
    // Mesajın bir gruptan gelip gelmediğini doğrudan ID üzerinden kontrol ediyoruz (@g.us = Grup)
    const isGroupMessage = msg.from.endsWith('@g.us');

    if (isGroupMessage) {
      const messageContent = msg.body;
      const senderPhone = msg.author || msg.from;

      // Kelime tarama
      const keywords = [
        'yük', 'kamyon', 'tir', 'tır', 'dorse', 'aranıyor', 
        'güzergah', 'ton', 'tonaj', 'boş', 'nakliye', 'frigo', 
        'damper', 'tenteli', 'l300', 'onteker', 'on teker', 'kasa'
      ];
      
      const isRelevant = keywords.some((kw) => 
        messageContent.toLowerCase().includes(kw)
      );

      if (isRelevant) {
        // İsteğe bağlı: Grup ismini getChat ile almayı deniyoruz, takılırsa varsayılan isim veriyoruz
        let groupName = 'WhatsApp Grubu';
        try {
          const chat = await Promise.race([
            msg.getChat(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
          ]);
          if (chat && chat.name) groupName = chat.name;
        } catch (e) {
          // İsim alınamazsa işleyiş aksamaz
        }

        console.log(`📩 [İLGİLİ İLAN YAKALANDI] Grup: ${groupName}`);

        const { error } = await supabase
          .from('whatsapp_messages')
          .insert([
            {
              group_name: groupName,
              sender_phone: senderPhone.replace('@c.us', '').replace('@s.whatsapp.net', ''),
              message_content: messageContent
            }
          ]);

        if (error) {
          console.error('❌ Supabase Yazma Hatası:', error.message);
        } else {
          console.log(`🚀 [SUPABASE'E BAŞARIYLA YAZILDI]`);
        }
      }
    }
  } catch (err) {
    console.error('⚠️ Hata:', err.message);
  }
});

client.on('auth_failure', (msg) => {
  console.error('❌ Oturum Hatası:', msg);
});

process.on('unhandledRejection', (reason) => {
  console.error('⚠️ Geçici Hata Yakalandı:', reason?.message || reason);
});

client.initialize();