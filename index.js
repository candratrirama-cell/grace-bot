const { 
  default: makeWASocket, 
  useMultiFileAuthState, 
  DisconnectReason,
  Browsers,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs-extra');
const moment = require('moment-timezone');
const axios = require('axios');
const cron = require('node-cron');

// ================ KONFIGURASI ================
const prefix = '.';
const ownerNumber = '6285600575696@s.whatsapp.net';
const botNumber = '6285797361889';
const sessionPath = './grace-session';
const tempPath = './temp';

// Database sederhana
const warningDb = new Map();
const antiLinkDB = new Map();
const totalHit = new Map();

// Buat folder temp
fs.ensureDirSync(tempPath);

console.log('🌸 Grace Bot Starting...');
console.log('=' .repeat(40));
console.log(`📱 Bot Number: ${botNumber}`);
console.log(`👤 Owner: ${ownerNumber.split('@')[0]}`);
console.log(`⏱️ Mode: Human-like (delay 2 detik)`);
console.log(`🗑️ Auto-cleanup: Setiap 20 menit`);
console.log('=' .repeat(40));

// ================ AUTO CLEANUP 20 MENIT ================
cron.schedule('*/20 * * * *', async () => {
  try {
    if (await fs.pathExists(tempPath)) {
      const files = await fs.readdir(tempPath);
      let deleted = 0;
      for (const file of files) {
        const filePath = `${tempPath}/${file}`;
        const stats = await fs.stat(filePath);
        const fileAge = Date.now() - stats.mtimeMs;
        if (fileAge > 20 * 60 * 1000) {
          await fs.remove(filePath);
          deleted++;
        }
      }
      if (deleted > 0) {
        console.log(`🧹 Cleanup: ${deleted} file dihapus (${moment().format('HH:mm:ss')})`);
      }
    }
  } catch (error) {
    console.error('Error cleanup:', error);
  }
});

console.log('🗑️ Auto-cleanup aktif: setiap 20 menit');

// ================ FUNGSI BANTUAN ================
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const sendTyping = async (sock, jid) => {
  try {
    await sock.sendPresenceUpdate('composing', jid);
  } catch(e) {}
};

const sendWithDelay = async (sock, jid, content, options = {}) => {
  const { typingDuration = 2000, isImage = false, isSticker = false, mentions = [] } = options;
  
  if (!isSticker) {
    await sendTyping(sock, jid);
  }
  
  await delay(typingDuration);
  
  if (isImage) {
    await sock.sendMessage(jid, { image: content.image, caption: content.caption, mentions });
  } else if (typeof content === 'object') {
    await sock.sendMessage(jid, { ...content, mentions });
  } else {
    await sock.sendMessage(jid, { text: content, mentions });
  }
};

// ================ FUNGSI ANTI-LINK ================
async function handleAntiLink(sock, sender, messageText, isAdmin, isGroup, msgId) {
  if (!isGroup || isAdmin) return false;
  
  const antiLinkActive = antiLinkDB.get(sender) || false;
  if (!antiLinkActive) return false;
  
  const linkPatterns = [
    /https?:\/\/[^\s]+/gi,
    /www\.[^\s]+/gi,
    /bit\.ly\/[^\s]+/gi,
    /tinyurl\.com\/[^\s]+/gi,
    /wa\.me\/[^\s]+/gi,
    /chat\.whatsapp\.com\/[^\s]+/gi
  ];
  
  let hasLink = false;
  for (const pattern of linkPatterns) {
    if (pattern.test(messageText)) {
      hasLink = true;
      break;
    }
  }
  
  if (hasLink) {
    try {
      await sock.sendMessage(sender, { delete: { remoteJid: sender, fromMe: false, id: msgId } });
    } catch(e) {}
    await delay(1500);
    
    if (!warningDb.has(sender)) {
      warningDb.set(sender, { count: 1 });
      await sendWithDelay(sock, sender, `⚠️ *PERINGATAN 1/3*\n\nDilarang mengirim link di grup ini!`);
    } else {
      const userWarning = warningDb.get(sender);
      userWarning.count++;
      
      if (userWarning.count >= 3) {
        try {
          await sock.groupParticipantsUpdate(sender, [sender.split('@')[0]], 'remove');
          warningDb.delete(sender);
          await sendWithDelay(sock, sender, `🚫 *ANDA DIKICK*\n\nKarena 3x mengirim link!`);
        } catch (error) {}
      } else {
        await sendWithDelay(sock, sender, `⚠️ *PERINGATAN ${userWarning.count}/3*\n\nDilarang mengirim link!`);
      }
    }
    return true;
  }
  return false;
}

// ================ FUNGSI UTAMA ================
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const { version } = await fetchLatestBaileysVersion();
  
  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    auth: state,
    browser: Browsers.macOS('Desktop'),
    printQRInTerminal: false,
    defaultQueryTimeoutMs: undefined,
    markOnlineOnConnect: true,
  });

  // Untuk Render, kita perlu pairing dengan cara manual via environment variable
  // Atau bot akan menggunakan session yang sudah ada
  
  console.log('\n📱 Menghubungkan ke WhatsApp...');
  console.log('💡 Jika pertama kali, bot akan membuat session baru\n');

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      console.log('📱 Scan QR Code di bawah ini dengan WhatsApp:');
      console.log(qr);
    }
    
    if (connection === 'open') {
      console.log('\n✅ Grace Bot Connected!');
      console.log(`📱 Bot Name: ${sock.user.name || 'Grace Bot'}`);
      console.log(`📱 Bot Number: ${sock.user.id.split(':')[0]}`);
      console.log(`🆓 Free Unlimited Bot by @maramadhona`);
      console.log(`⏱️ Mode manusia aktif (delay 2 detik)`);
      console.log(`🗑️ Auto-cleanup: 20 menit\n`);
      
      try {
        await delay(2000);
        await sendWithDelay(sock, ownerNumber, `🌸 *GRACE BOT AKTIF*\n\n⏰ ${moment().tz('Asia/Jakarta').format('DD/MM/YYYY HH:mm:ss')}\n📱 Bot Aktif!\n✨ Free Unlimited Bot\n@maramadhona`);
        console.log('✅ Notifikasi terkirim ke owner');
      } catch(e) {}
    }
    
    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      console.log(`❌ Disconnected: ${reason}`);
      
      if (reason === DisconnectReason.loggedOut) {
        console.log('🔐 Session expired! Hapus folder session...');
        await fs.remove(sessionPath);
      }
      console.log('🔄 Reconnecting in 10 seconds...');
      setTimeout(() => startBot(), 10000);
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // Handler pesan
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    
    const msg = messages[0];
    if (!msg.message) return;
    
    const sender = msg.key.remoteJid;
    const isGroup = sender.endsWith('@g.us');
    let isAdmin = false;
    const msgId = msg.key.id;
    
    totalHit.set(sender, (totalHit.get(sender) || 0) + 1);
    
    if (isGroup) {
      try {
        const groupMetadata = await sock.groupMetadata(sender);
        const participant = groupMetadata.participants.find(p => p.id === (msg.key.participant || sender));
        isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
      } catch (error) {}
    }
    
    let body = '';
    if (msg.message.conversation) {
      body = msg.message.conversation;
    } else if (msg.message.extendedTextMessage) {
      body = msg.message.extendedTextMessage.text;
    } else {
      return;
    }
    
    if (isGroup && body && !isAdmin) {
      const isLink = await handleAntiLink(sock, sender, body, isAdmin, isGroup, msgId);
      if (isLink) return;
    }
    
    if (!body.startsWith(prefix)) return;
    
    const args = body.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    
    console.log(`📨 ${sender.split('@')[0]}: ${command}`);
    
    // MENU
    if (command === 'menu' || command === 'help') {
      const menuText = `╭━━━━❲ *GRACE BOT MENU* ❳━━━━╮
┃
┃ ✨ *Grace Bot* by @maramadhona
┃ 🤖 *Prefix* : ${prefix}
┃ 🆓 *Status* : Free Unlimited
┃ ⏱️ *Mode* : Human-like (2s delay)
┃ 🗑️ *Cleanup* : Setiap 20 menit
┃ 📊 *Hit count* : ${totalHit.size} user
┃
┡━━━━❲ *🛠️ AI & MAKER* ❳━━━━
┃│ ${prefix}wmgpt [pesan] - AI WormGPT
┃│ ${prefix}brat [teks] - Teks style brat
┃│ ${prefix}blurface [url] - Blur wajah
┃│ ${prefix}wfu - Random Waifu
┃│ ${prefix}qtsanim - Quote anime
┃│ ${prefix}ssweb [url] - Screenshot web
┃
┡━━━━❲ *👑 GROUP MANAGEMENT* ❳━━━
┃│ ${prefix}antilink on/off - Anti link
┃│ ${prefix}warn @user - Peringatan
┃│ ${prefix}cek warn @user - Cek warn
┃│ ${prefix}delwarn @user - Hapus warn
┃│ ${prefix}kick @user - Kick member
┃│ ${prefix}add 62xxx - Tambah member
┃│ ${prefix}promote @user - Jadi admin
┃│ ${prefix}demote @user - Hapus admin
┃│ ${prefix}tagall - Mention semua
┃│ ${prefix}del - Hapus pesan
┃│ ${prefix}setgroup - Buka/tutup grup
┃│ ${prefix}setname - Ganti nama
┃│ ${prefix}setdesc - Ganti deskripsi
┃│ ${prefix}setpp - Ganti foto
┃│ ${prefix}listadmin - Daftar admin
┃│ ${prefix}getlink - Link grup
┃│ ${prefix}mute/unmute - Bisukan grup
┃│ ${prefix}groupinfo - Info grup
┃│ ${prefix}leave - Keluar grup
┃
┡━━━━❲ *🔧 UTILITY* ❳━━━━━
┃│ ${prefix}sticker - Buat stiker
┃│ ${prefix}ping - Cek respon
┃│ ${prefix}info - Info bot
┃│ ${prefix}owner - Kontak owner
┃│ ${prefix}time - Waktu sekarang
┃│ ${prefix}profile - Info profil
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━╯

> 🌸 Grace Bot - Free Unlimited
> 📢 Channel: https://whatsapp.com/channel/0029VbDNN114inopcqNHIa3f
> TikTok: @maramadhona`;
      
      await sendWithDelay(sock, sender, menuText);
    }
    
    // AI WMGPT
    else if (command === 'wmgpt') {
      const query = args.join(' ');
      if (!query) {
        await sendWithDelay(sock, sender, `❌ Contoh: ${prefix}wmgpt Halo apa kabar?`);
        return;
      }
      
      await sendWithDelay(sock, sender, '🤔 Grace AI sedang berpikir...', { typingDuration: 1500 });
      
      try {
        const response = await axios.get(`https://api.danzy.web.id/api/ai/wormgpt?q=${encodeURIComponent(query)}`, { timeout: 15000 });
        const result = response.data;
        let reply = result.result || result.data || result.message || 'Maaf, tidak bisa memproses.';
        await sendWithDelay(sock, sender, `💬 *AI Response*\n\n${reply}`, { typingDuration: 3000 });
      } catch (error) {
        await sendWithDelay(sock, sender, '❌ AI error, coba lagi nanti.');
      }
    }
    
    // BRAT TEXT
    else if (command === 'brat') {
      const text = args.join(' ');
      if (!text) {
        await sendWithDelay(sock, sender, `❌ Contoh: ${prefix}brat Grace Bot`);
        return;
      }
      
      await sendWithDelay(sock, sender, '🎨 Membuat teks brat...', { typingDuration: 1500 });
      
      try {
        const response = await axios.get(`https://api.danzy.web.id/api/maker/brat?text=${encodeURIComponent(text)}`, { responseType: 'arraybuffer', timeout: 15000 });
        await sendWithDelay(sock, sender, 
          { image: Buffer.from(response.data), caption: `✨ *Brat Text:* ${text}\n🌸 Grace Bot` },
          { typingDuration: 2000, isImage: true }
        );
      } catch (error) {
        await sendWithDelay(sock, sender, '❌ Gagal membuat brat text.');
      }
    }
    
    // BLUR FACE
    else if (command === 'blurface') {
      const url = args[0];
      if (!url) {
        await sendWithDelay(sock, sender, `❌ Contoh: ${prefix}blurface https://example.com/image.jpg`);
        return;
      }
      
      await sendWithDelay(sock, sender, '👤 Memblurkan wajah...', { typingDuration: 1500 });
      
      try {
        const response = await axios.get(`https://api.danzy.web.id/api/maker/blurface?url=${encodeURIComponent(url)}`, { responseType: 'arraybuffer', timeout: 15000 });
        await sendWithDelay(sock, sender,
          { image: Buffer.from(response.data), caption: `✨ *Blur Face Effect*\n🌸 Grace Bot` },
          { typingDuration: 2000, isImage: true }
        );
      } catch (error) {
        await sendWithDelay(sock, sender, '❌ Gagal memproses gambar.');
      }
    }
    
    // RANDOM WAIFU
    else if (command === 'wfu') {
      await sendWithDelay(sock, sender, '🎴 Mencari waifu...', { typingDuration: 1000 });
      
      try {
        const response = await axios.get('https://api.danzy.web.id/api/random/waifu', { responseType: 'arraybuffer', timeout: 15000 });
        await sendWithDelay(sock, sender,
          { image: Buffer.from(response.data), caption: `🌸 *Random Waifu*\n✨ Grace Bot` },
          { typingDuration: 2000, isImage: true }
        );
      } catch (error) {
        await sendWithDelay(sock, sender, '❌ Gagal mengambil waifu.');
      }
    }
    
    // QUOTE ANIME
    else if (command === 'qtsanim') {
      await sendWithDelay(sock, sender, '📖 Mengambil quote anime...', { typingDuration: 1000 });
      
      try {
        const response = await axios.get('https://api.danzy.web.id/api/random/quotesanime', { timeout: 15000 });
        const quote = response.data;
        let text = quote.result?.quote || quote.result?.text || quote.data || 'Quote tidak tersedia';
        await sendWithDelay(sock, sender, `📖 *Quote Anime*\n\n"${text}"`);
      } catch (error) {
        await sendWithDelay(sock, sender, '❌ Gagal mengambil quote.');
      }
    }
    
    // SCREENSHOT WEBSITE
    else if (command === 'ssweb') {
      const url = args[0];
      if (!url) {
        await sendWithDelay(sock, sender, `❌ Contoh: ${prefix}ssweb https://google.com`);
        return;
      }
      
      await sendWithDelay(sock, sender, '📸 Screenshot website...', { typingDuration: 1500 });
      
      try {
        const response = await axios.get(`https://api.danzy.web.id/api/tools/ssweb?url=${encodeURIComponent(url)}&type=desktop`, { responseType: 'arraybuffer', timeout: 20000 });
        await sendWithDelay(sock, sender,
          { image: Buffer.from(response.data), caption: `🌐 *Screenshot*\nURL: ${url}\n🌸 Grace Bot` },
          { typingDuration: 2000, isImage: true }
        );
      } catch (error) {
        await sendWithDelay(sock, sender, '❌ Gagal screenshot.');
      }
    }
    
    // STIKER
    else if (command === 'sticker' || command === 's') {
      if (msg.message?.imageMessage || msg.message?.videoMessage) {
        await sendWithDelay(sock, sender, '🎨 Membuat stiker...', { typingDuration: 1000 });
        const buffer = await sock.downloadMediaMessage(msg);
        await sock.sendMessage(sender, { sticker: buffer });
      } else {
        await sendWithDelay(sock, sender, `❌ Kirim gambar/video dengan caption ${prefix}sticker`);
      }
    }
    
    // GROUP MANAGEMENT - ANTI LINK
    else if (command === 'antilink' && isGroup && isAdmin) {
      const action = args[0];
      if (!action || (action !== 'on' && action !== 'off')) {
        await sendWithDelay(sock, sender, `❌ Contoh: ${prefix}antilink on/off`);
        return;
      }
      antiLinkDB.set(sender, action === 'on');
      await sendWithDelay(sock, sender, `${action === 'on' ? '✅ Anti-link DIaktifkan' : '❌ Anti-link DInonaktifkan'}`);
    }
    
    // GROUP MANAGEMENT - WARN
    else if (command === 'warn' && isGroup && isAdmin) {
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
      if (!mentioned || mentioned.length === 0) {
        await sendWithDelay(sock, sender, '❌ Tag member yang ingin diwarn!');
        return;
      }
      const target = mentioned[0];
      
      if (!warningDb.has(target)) {
        warningDb.set(target, { count: 1 });
        await sendWithDelay(sock, sender, `⚠️ @${target.split('@')[0]} mendapat peringatan 1/3`, { mentions: [target] });
      } else {
        const userWarning = warningDb.get(target);
        userWarning.count++;
        if (userWarning.count >= 3) {
          try {
            await sock.groupParticipantsUpdate(sender, [target.split('@')[0]], 'remove');
            warningDb.delete(target);
            await sendWithDelay(sock, sender, `🚫 @${target.split('@')[0]} dikeluarkan karena 3x peringatan!`, { mentions: [target] });
          } catch (error) {}
        } else {
          await sendWithDelay(sock, sender, `⚠️ @${target.split('@')[0]} peringatan ${userWarning.count}/3`, { mentions: [target] });
        }
      }
    }
    
    // GROUP MANAGEMENT - CEK WARN
    else if (command === 'cek warn' && isGroup) {
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
      if (!mentioned || mentioned.length === 0) {
        await sendWithDelay(sock, sender, '❌ Tag member yang ingin dicek!');
        return;
      }
      const target = mentioned[0];
      const userWarning = warningDb.get(target);
      const warnCount = userWarning ? userWarning.count : 0;
      await sendWithDelay(sock, sender, `📊 @${target.split('@')[0]} memiliki ${warnCount}/3 peringatan`, { mentions: [target] });
    }
    
    // GROUP MANAGEMENT - DELWARN
    else if (command === 'delwarn' && isGroup && isAdmin) {
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
      if (!mentioned || mentioned.length === 0) {
        await sendWithDelay(sock, sender, '❌ Tag member!');
        return;
      }
      warningDb.delete(mentioned[0]);
      await sendWithDelay(sock, sender, `✅ Peringatan dihapus!`);
    }
    
    // GROUP MANAGEMENT - KICK
    else if (command === 'kick' && isGroup && isAdmin) {
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
      if (!mentioned || mentioned.length === 0) {
        await sendWithDelay(sock, sender, '❌ Tag member yang ingin dikick!');
        return;
      }
      try {
        await sock.groupParticipantsUpdate(sender, mentioned, 'remove');
        await sendWithDelay(sock, sender, `✅ Berhasil dikick!`);
      } catch (error) {
        await sendWithDelay(sock, sender, '❌ Gagal!');
      }
    }
    
    // GROUP MANAGEMENT - ADD
    else if (command === 'add' && isGroup && isAdmin) {
      const number = args[0];
      if (!number) {
        await sendWithDelay(sock, sender, `❌ Contoh: ${prefix}add 628123456789`);
        return;
      }
      try {
        let formattedNumber = number.endsWith('@s.whatsapp.net') ? number : `${number}@s.whatsapp.net`;
        await sock.groupParticipantsUpdate(sender, [formattedNumber], 'add');
        await sendWithDelay(sock, sender, `✅ Berhasil ditambahkan!`);
      } catch (error) {
        await sendWithDelay(sock, sender, '❌ Gagal! Pastikan nomor benar.');
      }
    }
    
    // GROUP MANAGEMENT - PROMOTE
    else if (command === 'promote' && isGroup && isAdmin) {
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
      if (!mentioned || mentioned.length === 0) {
        await sendWithDelay(sock, sender, '❌ Tag member!');
        return;
      }
      try {
        await sock.groupParticipantsUpdate(sender, mentioned, 'promote');
        await sendWithDelay(sock, sender, `✅ Berhasil promote!`);
      } catch (error) {
        await sendWithDelay(sock, sender, '❌ Gagal!');
      }
    }
    
    // GROUP MANAGEMENT - DEMOTE
    else if (command === 'demote' && isGroup && isAdmin) {
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
      if (!mentioned || mentioned.length === 0) {
        await sendWithDelay(sock, sender, '❌ Tag admin!');
        return;
      }
      try {
        await sock.groupParticipantsUpdate(sender, mentioned, 'demote');
        await sendWithDelay(sock, sender, `✅ Berhasil demote!`);
      } catch (error) {
        await sendWithDelay(sock, sender, '❌ Gagal!');
      }
    }
    
    // GROUP MANAGEMENT - TAGALL
    else if (command === 'tagall' && isGroup && isAdmin) {
      try {
        const groupMetadata = await sock.groupMetadata(sender);
        const participants = groupMetadata.participants;
        let mentionText = '📢 *PENGUMUMAN*\n\n';
        const mentions = [];
        for (const participant of participants) {
          mentionText += `@${participant.id.split('@')[0]}\n`;
          mentions.push(participant.id);
        }
        await sendWithDelay(sock, sender, { text: mentionText, mentions });
      } catch (error) {
        await sendWithDelay(sock, sender, '❌ Gagal tagall!');
      }
    }
    
    // GROUP MANAGEMENT - DEL
    else if (command === 'del' && isGroup && isAdmin) {
      const replyMsg = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
      if (!replyMsg) {
        await sendWithDelay(sock, sender, '❌ Balas pesan yang ingin dihapus!');
        return;
      }
      try {
        await sock.sendMessage(sender, { delete: { remoteJid: sender, fromMe: false, id: replyMsg } });
        await sendWithDelay(sock, sender, '✅ Pesan dihapus!');
      } catch (error) {
        await sendWithDelay(sock, sender, '❌ Gagal!');
      }
    }
    
    // GROUP MANAGEMENT - SETGROUP
    else if (command === 'setgroup' && isGroup && isAdmin) {
      const action = args[0];
      if (!action || (action !== 'open' && action !== 'close')) {
        await sendWithDelay(sock, sender, `❌ Contoh: ${prefix}setgroup open/close`);
        return;
      }
      try {
        await sock.groupSettingUpdate(sender, action === 'open' ? 'unlock' : 'lock');
        await sendWithDelay(sock, sender, `${action === 'open' ? '🔓 Grup dibuka' : '🔒 Grup ditutup'}`);
      } catch (error) {
        await sendWithDelay(sock, sender, '❌ Gagal!');
      }
    }
    
    // GROUP MANAGEMENT - SETNAME
    else if (command === 'setname' && isGroup && isAdmin) {
      const newName = args.join(' ');
      if (!newName) {
        await sendWithDelay(sock, sender, `❌ Contoh: ${prefix}setname Nama Baru`);
        return;
      }
      try {
        await sock.groupUpdateSubject(sender, newName);
        await sendWithDelay(sock, sender, `✅ Nama grup: ${newName}`);
      } catch (error) {
        await sendWithDelay(sock, sender, '❌ Gagal!');
      }
    }
    
    // GROUP MANAGEMENT - SETDESC
    else if (command === 'setdesc' && isGroup && isAdmin) {
      const newDesc = args.join(' ');
      if (!newDesc) {
        await sendWithDelay(sock, sender, `❌ Contoh: ${prefix}setdesc Deskripsi baru`);
        return;
      }
      try {
        await sock.groupUpdateDescription(sender, newDesc);
        await sendWithDelay(sock, sender, '✅ Deskripsi diperbarui!');
      } catch (error) {
        await sendWithDelay(sock, sender, '❌ Gagal!');
      }
    }
    
    // GROUP MANAGEMENT - SETPP
    else if (command === 'setpp' && isGroup && isAdmin) {
      if (!msg.message?.imageMessage) {
        await sendWithDelay(sock, sender, `❌ Kirim gambar dengan caption ${prefix}setpp`);
        return;
      }
      try {
        const buffer = await sock.downloadMediaMessage(msg);
        await sock.updateProfilePicture(sender, buffer);
        await sendWithDelay(sock, sender, '✅ Foto grup diubah!');
      } catch (error) {
        await sendWithDelay(sock, sender, '❌ Gagal!');
      }
    }
    
    // GROUP MANAGEMENT - DELPP
    else if (command === 'delpp' && isGroup && isAdmin) {
      try {
        await sock.removeProfilePicture(sender);
        await sendWithDelay(sock, sender, '✅ Foto grup dihapus!');
      } catch (error) {
        await sendWithDelay(sock, sender, '❌ Gagal!');
      }
    }
    
    // GROUP MANAGEMENT - LISTADMIN
    else if (command === 'listadmin' && isGroup) {
      try {
        const groupMetadata = await sock.groupMetadata(sender);
        const admins = groupMetadata.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');
        let text = '👑 *DAFTAR ADMIN*\n━━━━━━━━━━━\n';
        for (const admin of admins) {
          text += `👤 @${admin.id.split('@')[0]}\n`;
        }
        text += `━━━━━━━━━━━\nTotal: ${admins.length} admin`;
        await sendWithDelay(sock, sender, { text, mentions: admins.map(a => a.id) });
      } catch (error) {
        await sendWithDelay(sock, sender, '❌ Gagal!');
      }
    }
    
    // GROUP MANAGEMENT - GETLINK
    else if (command === 'getlink' && isGroup) {
      try {
        const code = await sock.groupInviteCode(sender);
        await sendWithDelay(sock, sender, `🔗 *Link Grup*\nhttps://chat.whatsapp.com/${code}`);
      } catch (error) {
        await sendWithDelay(sock, sender, '❌ Gagal! (Grup mungkin tertutup)');
      }
    }
    
    // GROUP MANAGEMENT - MUTE
    else if (command === 'mute' && isGroup && isAdmin) {
      try {
        await sock.groupSettingUpdate(sender, 'announcement');
        await sendWithDelay(sock, sender, '🔇 Grup dimute! Hanya admin bisa chat.');
      } catch (error) {
        await sendWithDelay(sock, sender, '❌ Gagal!');
      }
    }
    
    // GROUP MANAGEMENT - UNMUTE
    else if (command === 'unmute' && isGroup && isAdmin) {
      try {
        await sock.groupSettingUpdate(sender, 'not_announcement');
        await sendWithDelay(sock, sender, '🔊 Grup diunmute! Semua bisa chat.');
      } catch (error) {
        await sendWithDelay(sock, sender, '❌ Gagal!');
      }
    }
    
    // GROUP MANAGEMENT - GROUPINFO
    else if (command === 'groupinfo' && isGroup) {
      try {
        const groupMetadata = await sock.groupMetadata(sender);
        const text = `📊 *INFO GRUP*
━━━━━━━━━━━
📛 Nama: ${groupMetadata.subject}
👥 Anggota: ${groupMetadata.participants?.length || 0} orang
👑 Pembuat: ${groupMetadata.owner?.split('@')[0] || 'Tidak diketahui'}
📅 Dibuat: ${moment(groupMetadata.creation * 1000).format('DD/MM/YYYY')}
🔒 Mode: ${groupMetadata.announce ? 'Hanya admin' : 'Semua anggota'}
━━━━━━━━━━━`;
        await sendWithDelay(sock, sender, text);
      } catch (error) {
        await sendWithDelay(sock, sender, '❌ Gagal!');
      }
    }
    
    // GROUP MANAGEMENT - LEAVE
    else if (command === 'leave' && isGroup && isAdmin) {
      await sendWithDelay(sock, sender, '👋 Grace Bot meninggalkan grup. Sampai jumpa!');
      setTimeout(() => sock.groupLeave(sender), 3000);
    }
    
    // UTILITY - PING
    else if (command === 'ping') {
      const start = Date.now();
      await sendWithDelay(sock, sender, '🏓 Pinging...', { typingDuration: 500 });
      const end = Date.now();
      await sendWithDelay(sock, sender, `⏱️ *Ping:* ${end - start}ms\n🌸 Grace Bot aktif!\n🗑️ Auto-cleanup 20 menit`);
    }
    
    // UTILITY - INFO
    else if (command === 'info') {
      const infoText = `🌸 *GRACE BOT INFO*
━━━━━━━━━━━
📱 Nama: Grace Bot
👤 Creator: @maramadhona
🔢 Nomor Bot: ${sock.user.id.split(':')[0] || botNumber}
🆓 Status: Free Unlimited
⏱️ Mode: Human-like (2s delay)
🗑️ Auto-cleanup: 20 menit
📊 User aktif: ${totalHit.size}
━━━━━━━━━━━
📢 Channel: https://whatsapp.com/channel/0029VbDNN114inopcqNHIa3f
🎵 TikTok: @maramadhona

> Bot tanpa limit, gratis selamanya!`;
      await sendWithDelay(sock, sender, infoText);
    }
    
    // UTILITY - OWNER
    else if (command === 'owner') {
      await sendWithDelay(sock, sender, `👤 *Owner*\n@maramadhona\n📞 ${ownerNumber.split('@')[0]}\n🎵 TikTok: @maramadhona`);
    }
    
    // UTILITY - TIME
    else if (command === 'time') {
      const waktu = moment().tz('Asia/Jakarta').format('dddd, DD MMMM YYYY HH:mm:ss');
      await sendWithDelay(sock, sender, `🕐 *Waktu Sekarang*\n${waktu}\n🌸 Grace Bot`);
    }
    
    // UTILITY - PROFILE
    else if (command === 'profile') {
      const pushname = msg.pushName || sender.split('@')[0];
      await sendWithDelay(sock, sender, `👤 *PROFIL ANDA*\n\nNama: ${pushname}\nNomor: ${sender.split('@')[0]}\nStatus: Terhubung dengan Grace Bot\n🌸 Free Unlimited Bot`);
    }
    
    else {
      await sendWithDelay(sock, sender, `❌ Command tidak dikenal!\nKetik ${prefix}menu`);
    }
  });
  
  console.log('✨ Grace Bot siap menerima pesan!');
  console.log('💡 Ketik .menu di WhatsApp untuk melihat semua fitur!\n');
}

// Jalankan bot
startBot().catch(error => {
  console.error('❌ Fatal Error:', error);
});
