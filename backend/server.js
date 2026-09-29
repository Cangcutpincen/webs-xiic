const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cors({ origin: true, credentials: false }));

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_THIS_IN_RAILWAY';
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) console.warn('DATABASE_URL belum diset. Tambahkan di Railway Variables.');
if (JWT_SECRET === 'CHANGE_THIS_IN_RAILWAY') console.warn('JWT_SECRET masih default. Ganti di Railway Variables.');

const pool = mysql.createPool(DATABASE_URL || 'mysql://root:@localhost:3306/xii_c_db');

const publicUserColumns = `id, username, name, role, saldo, bio, status, avatar, banner, frame, pin_enabled AS pinEnabled, ig, wa, discord, created_at`;

function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Login diperlukan.' });
  try { req.auth = jwt.verify(token, JWT_SECRET); if (req.auth.pinPending) return res.status(401).json({ message: 'Verifikasi PIN diperlukan.' }); next(); }
  catch { return res.status(401).json({ message: 'Sesi login tidak valid atau sudah kedaluwarsa.' }); }
}

function adminOnly(req, res, next) {
  if (req.auth?.role !== 'Administrator') return res.status(403).json({ message: 'Akses administrator diperlukan.' });
  next();
}

async function ensureSchema() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, name VARCHAR(100) NOT NULL,
    role VARCHAR(50) DEFAULT 'Pengunjung', saldo DECIMAL(12,2) DEFAULT 50000,
    bio TEXT, status VARCHAR(255), avatar VARCHAR(500), banner VARCHAR(50) DEFAULT 'animated-banner-1',
    frame VARCHAR(50) DEFAULT 'none', pin_hash VARCHAR(255) DEFAULT NULL, pin_enabled TINYINT DEFAULT 0,
    ig VARCHAR(500), wa VARCHAR(500), discord VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS announcements (
    id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(255) NOT NULL, tag VARCHAR(100) NOT NULL,
    date_label VARCHAR(100) NOT NULL, description TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS homework (
    id INT AUTO_INCREMENT PRIMARY KEY, subject VARCHAR(150) NOT NULL, title VARCHAR(255) NOT NULL,
    deadline VARCHAR(150) NOT NULL, status VARCHAR(50) DEFAULT 'Pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS wallet_transactions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, from_username VARCHAR(50), to_username VARCHAR(50),
    amount DECIMAL(12,2) NOT NULL, type VARCHAR(30) NOT NULL, description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_wallet_from (from_username), INDEX idx_wallet_to (to_username)
  )`);
}

const seedUsers = [
  ['zyen','Steven@0921','Zyen (Master Admin)','Administrator',5000000,'System Administrator & Backend Master XII C 2026/2027.','Menjaga sistem tetap optimal 🛡️','https://placehold.co/150x150/10b981/ffffff?text=ZYEN','animated-banner-3','cyber'],
  ['ibu_aminah','123','Ibu Dra. Hj. Siti Aminah, M.Pd','Wali Kelas',250000,'Wali kelas berdedikasi tinggi demi kesuksesan siswa XII C.','Mendidik dengan hati 💙','https://placehold.co/150x150/4f46e5/ffffff?text=Wali','animated-banner-1','none'],
  ['aditya','123','Aditya Pratama','Ketua Kelas',150000,'Siap memimpin kelas XII C solid dan kompak selalu.','Fokus sukses PTN 2027 🚀','https://placehold.co/150x150/6366f1/ffffff?text=AP','animated-banner-2','cosmic'],
  ['alya','123','Alya Zahra','Wakil Ketua',120000,'Mendukung penuh setiap program kerja kelas.','Semangat belajar!','https://placehold.co/150x150/4f46e5/ffffff?text=AZ','animated-banner-1','none'],
  ['dimas','123','Dimas Anggara','Sekretaris',95000,'Mencatat segala administrasi kelas dengan rapi.','Disiplin nomor satu','https://placehold.co/150x150/312e81/ffffff?text=DA','animated-banner-3','neon'],
  ['dewi','123','Dewi Lestari','Bendahara',300000,'Mengelola kas kelas transparan & akuntabel.','Kas lancar jaya ✨','https://placehold.co/150x150/818cf8/ffffff?text=DL','animated-banner-2','none'],
  ['fajar','123','Fajar Ramadhan','Seksi Keamanan',50000,'Menjaga ketertiban kelas dan lingkungan sekitar.','Aman dan terkendali','https://placehold.co/150x150/6366f1/ffffff?text=FR','animated-banner-1','none'],
  ['intan','123','Intan Permata','Seksi Kebersihan',75000,'Kebersihan adalah sebagian dari iman.','Kelas bersih hati bersih','https://placehold.co/150x150/4f46e5/ffffff?text=IP','animated-banner-3','none'],
  ['rezky','123','Rezky Kurniawan','Siswa / Anggota',110000,'Anak IT dan penikmat kopi.','Ngoding setiap hari','https://placehold.co/150x150/312e81/ffffff?text=RK','animated-banner-2','cyber']
];

async function seedData() {
  const [[cnt]] = await pool.query('SELECT COUNT(*) AS c FROM users');
  if (cnt.c === 0) {
    for (const u of seedUsers) {
      const hash = await bcrypt.hash(u[1], 10);
      await pool.query(`INSERT INTO users (username,password_hash,name,role,saldo,bio,status,avatar,banner,frame,ig,wa,discord)
        VALUES (?,?,?,?,?,?,?,?,?,?, 'https://instagram.com','https://whatsapp.com','https://discord.com')`, [u[0],hash,u[2],u[3],u[4],u[5],u[6],u[7],u[8],u[9]]);
    }
  }
  const [[ac]] = await pool.query('SELECT COUNT(*) AS c FROM announcements');
  if (ac.c === 0) await pool.query('INSERT INTO announcements (title,tag,date_label,description) VALUES (?,?,?,?),(?,?,?,?),(?,?,?,?)', [
    'Pembagian Kelompok Ujian Praktik','Akademik','28 Sep 2026','Daftar kelompok ujian praktik semester ganjil tahun ajaran 2026/2027 sudah dapat dicek di mading kelas.',
    'Iuran Kas Kelas Bulanan','Bendahara','25 Sep 2026','Pembayaran kas kelas minggu ini dikoordinasikan langsung oleh Bendahara Dewi Lestari.',
    'Jadwal Piket Baru 2026','Kebersihan','20 Sep 2026','Harap seluruh anggota piket harian datang 15 menit lebih awal sebelum bel masuk.'
  ]);
  const [[hc]] = await pool.query('SELECT COUNT(*) AS c FROM homework');
  if (hc.c === 0) await pool.query('INSERT INTO homework (subject,title,deadline,status) VALUES (?,?,?,?),(?,?,?,?),(?,?,?,?)', [
    'Matematika Tingkat Lanjut','Latihan Soal Limit & Turunan','Kamis, 1 Oktober 2026','Pending',
    'Fisika Peminatan','Laporan Praktikum Listrik Dinamis','Jumat, 2 Oktober 2026','Pending',
    'Informatika','Deploy Web Portal Kelas ke Server','Senin, 5 Oktober 2026','Pending'
  ]);
}

app.get('/api/health', async (req,res) => {
  try { await pool.query('SELECT 1'); res.json({ status:'OK', database:'connected' }); }
  catch (e) { res.status(503).json({ status:'ERROR', database:'disconnected', message:e.message }); }
});

app.post('/api/login', async (req,res) => {
  try {
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const [rows] = await pool.query('SELECT * FROM users WHERE username=? LIMIT 1', [username]);
    if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash))) return res.status(401).json({ message:'Username atau password salah!' });
    const user = rows[0];
    const requiresPin = !!user.pin_enabled;
    const token = requiresPin ? jwt.sign({ id:user.id, username:user.username, role:user.role, pinPending:true }, JWT_SECRET, { expiresIn:'5m' }) : signToken(user);
    res.json({ message: requiresPin ? 'Password benar, PIN diperlukan.' : 'Login berhasil', token, requiresPin, user: publicUser(user) });
  } catch(e) { res.status(500).json({ message:e.message }); }
});

function preAuth(req,res,next){ const h=req.headers.authorization||''; const token=h.startsWith('Bearer ')?h.slice(7):null; if(!token)return res.status(401).json({message:'Verifikasi PIN diperlukan.'}); try{req.auth=jwt.verify(token,JWT_SECRET); if(!req.auth.pinPending) return res.status(400).json({message:'Sesi PIN tidak diperlukan.'}); next();}catch{return res.status(401).json({message:'Sesi PIN tidak valid.'});} }

app.post('/api/login/verify-pin', preAuth, async (req,res) => {
  try {
    const pin = String(req.body.pin || '');
    const [rows] = await pool.query('SELECT * FROM users WHERE id=? LIMIT 1', [req.auth.id]);
    if (!rows.length || !rows[0].pin_enabled || !(await bcrypt.compare(pin, rows[0].pin_hash || ''))) return res.status(401).json({ message:'PIN keamanan salah.' });
    const fullToken = signToken(rows[0]);
    res.json({ message:'PIN benar', token:fullToken, user:publicUser(rows[0]) });
  } catch(e) { res.status(500).json({ message:e.message }); }
});

app.post('/api/register', async (req,res) => {
  try {
    const name=String(req.body.name||'').trim(), username=String(req.body.username||'').trim().toLowerCase(), password=String(req.body.password||'');
    if (!name || !username || password.length < 3) return res.status(400).json({message:'Nama, username, dan password wajib diisi.'});
    const [exists] = await pool.query('SELECT id FROM users WHERE username=?', [username]);
    if (exists.length) return res.status(409).json({message:'Username sudah terpakai.'});
    const hash=await bcrypt.hash(password,10);
    const avatar=`https://placehold.co/150x150/6366f1/ffffff?text=${encodeURIComponent(name.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase())}`;
    const [r]=await pool.query(`INSERT INTO users (username,password_hash,name,role,saldo,bio,status,avatar,banner,frame,ig,wa,discord) VALUES (?,?,?,?,?,?,?,?,?,'none','https://instagram.com','https://whatsapp.com','https://discord.com')`, [username,hash,name,'Pengunjung',50000,'Anggota baru kelas XII C.','Semangat belajar!',avatar,'animated-banner-1']);
    const [rows]=await pool.query('SELECT * FROM users WHERE id=?',[r.insertId]);
    res.status(201).json({message:'Pendaftaran berhasil.',token:signToken(rows[0]),user:publicUser(rows[0])});
  } catch(e){res.status(500).json({message:e.message});}
});

app.get('/api/students', async (req,res) => {
  try { const [rows]=await pool.query(`SELECT ${publicUserColumns} FROM users WHERE role <> 'Pengunjung' ORDER BY id ASC`); res.json(rows); }
  catch(e){res.status(500).json({message:e.message});}
});

app.get('/api/me', auth, async (req,res)=>{ const [r]=await pool.query(`SELECT ${publicUserColumns} FROM users WHERE id=?`,[req.auth.id]); res.json(r[0]||null); });

app.put('/api/me/profile', auth, async (req,res)=>{
  try { const {name,status,bio,banner,frame}=req.body; await pool.query('UPDATE users SET name=?,status=?,bio=?,banner=?,frame=? WHERE id=?',[name,status,bio,banner,frame,req.auth.id]); const [r]=await pool.query(`SELECT ${publicUserColumns} FROM users WHERE id=?`,[req.auth.id]); res.json(r[0]); }
  catch(e){res.status(500).json({message:e.message});}
});

app.put('/api/me/security-pin', auth, async (req,res)=>{
  try { const pin=String(req.body.pin||''); if(pin && !/^\d{4,6}$/.test(pin)) return res.status(400).json({message:'PIN harus 4-6 digit.'}); const hash=pin?await bcrypt.hash(pin,10):null; await pool.query('UPDATE users SET pin_hash=?,pin_enabled=? WHERE id=?',[hash,pin?1:0,req.auth.id]); const [r]=await pool.query(`SELECT ${publicUserColumns} FROM users WHERE id=?`,[req.auth.id]); res.json(r[0]); }
  catch(e){res.status(500).json({message:e.message});}
});

app.post('/api/wallet/deposit', auth, async (req,res)=>{
  try { const amount=Number(req.body.amount); if(!Number.isFinite(amount)||amount<=0) return res.status(400).json({message:'Nominal deposit tidak valid.'}); await pool.query('UPDATE users SET saldo=saldo+? WHERE id=?',[amount,req.auth.id]); await pool.query('INSERT INTO wallet_transactions (to_username,amount,type,description) VALUES ((SELECT username FROM users WHERE id=?),?,"deposit",?)',[req.auth.id,amount,'Deposit saldo']); const [r]=await pool.query(`SELECT ${publicUserColumns} FROM users WHERE id=?`,[req.auth.id]); res.json(r[0]); }
  catch(e){res.status(500).json({message:e.message});}
});

app.post('/api/wallet/transfer', auth, async (req,res)=>{
  const conn=await pool.getConnection();
  try { const to=String(req.body.recipientUsername||'').trim().toLowerCase(), amount=Number(req.body.amount); if(!to||!Number.isFinite(amount)||amount<=0) return res.status(400).json({message:'Penerima atau nominal tidak valid.'}); await conn.beginTransaction(); const [[from]]=await conn.query('SELECT * FROM users WHERE id=? FOR UPDATE',[req.auth.id]); const [[toUser]]=await conn.query('SELECT * FROM users WHERE username=? FOR UPDATE',[to]); if(!toUser) throw new Error('Penerima tidak ditemukan.'); if(from.saldo<amount) throw new Error('Saldo tidak cukup.'); await conn.query('UPDATE users SET saldo=saldo-? WHERE id=?',[amount,from.id]); await conn.query('UPDATE users SET saldo=saldo+? WHERE id=?',[amount,toUser.id]); await conn.query('INSERT INTO wallet_transactions (from_username,to_username,amount,type,description) VALUES (?,?,?,?,?)',[from.username,toUser.username,amount,'transfer',`Transfer ke ${toUser.name}`]); await conn.commit(); const [[updated]]=await conn.query(`SELECT ${publicUserColumns} FROM users WHERE id=?`,[from.id]); res.json({message:'Transfer berhasil.',user:updated}); }
  catch(e){await conn.rollback();res.status(400).json({message:e.message});} finally {conn.release();}
});

app.post('/api/wallet/purchase', auth, async (req,res)=>{
  try { const amount=Number(req.body.amount), description=String(req.body.description||'Pembelian'); if(!Number.isFinite(amount)||amount<=0) return res.status(400).json({message:'Harga tidak valid.'}); const [r]=await pool.query('UPDATE users SET saldo=saldo-? WHERE id=? AND saldo>=?',[amount,req.auth.id,amount]); if(!r.affectedRows) return res.status(400).json({message:'Saldo tidak cukup.'}); await pool.query('INSERT INTO wallet_transactions (from_username,amount,type,description) VALUES ((SELECT username FROM users WHERE id=?),?,"purchase",?)',[req.auth.id,amount,description]); const [u]=await pool.query(`SELECT ${publicUserColumns} FROM users WHERE id=?`,[req.auth.id]); res.json(u[0]); }
  catch(e){res.status(500).json({message:e.message});}
});

app.get('/api/announcements', async(req,res)=>{const [r]=await pool.query('SELECT id,title,tag,date_label AS date,description AS desc FROM announcements ORDER BY created_at DESC,id DESC');res.json(r);});
app.post('/api/announcements',auth,adminOnly,async(req,res)=>{const {title,tag,desc}=req.body;const [r]=await pool.query('INSERT INTO announcements(title,tag,date_label,description) VALUES(?,?,?,?)',[title,tag,'Hari ini',desc]);const [[row]]=await pool.query('SELECT id,title,tag,date_label AS date,description AS desc FROM announcements WHERE id=?',[r.insertId]);res.status(201).json(row);});
app.delete('/api/announcements/:id',auth,adminOnly,async(req,res)=>{await pool.query('DELETE FROM announcements WHERE id=?',[req.params.id]);res.json({message:'Pengumuman dihapus.'});});

app.get('/api/homework',async(req,res)=>{const [r]=await pool.query('SELECT id,subject,title,deadline,status FROM homework ORDER BY created_at DESC,id DESC');res.json(r);});
app.post('/api/homework',auth,adminOnly,async(req,res)=>{const {subject,title,deadline}=req.body;const [r]=await pool.query('INSERT INTO homework(subject,title,deadline,status) VALUES(?,?,?,"Pending")',[subject,title,deadline]);const [[row]]=await pool.query('SELECT id,subject,title,deadline,status FROM homework WHERE id=?',[r.insertId]);res.status(201).json(row);});
app.delete('/api/homework/:id',auth,adminOnly,async(req,res)=>{await pool.query('DELETE FROM homework WHERE id=?',[req.params.id]);res.json({message:'Tugas dihapus.'});});

app.post('/api/students',auth,adminOnly,async(req,res)=>{
  try { const {name,username,password,role}=req.body; if(!name||!username||!password||!role)return res.status(400).json({message:'Data akun belum lengkap.'}); const [x]=await pool.query('SELECT id FROM users WHERE username=?',[username.toLowerCase()]); if(x.length)return res.status(409).json({message:'Username sudah dipakai.'}); const hash=await bcrypt.hash(password,10); const initials=name.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase(); const avatar=`https://placehold.co/150x150/6366f1/ffffff?text=${initials}`; const [r]=await pool.query(`INSERT INTO users(username,password_hash,name,role,saldo,bio,status,avatar,banner,frame,ig,wa,discord) VALUES(?,?,?,?,50000,?,?,?,?, 'https://instagram.com','https://whatsapp.com','https://discord.com')`,[username.toLowerCase(),hash,name,role,'Anggota baru kelas XII C.','Semangat belajar!',avatar,'animated-banner-1','none']); const [u]=await pool.query(`SELECT ${publicUserColumns} FROM users WHERE id=?`,[r.insertId]);res.status(201).json(u[0]); }
  catch(e){res.status(500).json({message:e.message});}
});

app.put('/api/students/:username',auth,adminOnly,async(req,res)=>{try{const old=String(req.params.username).toLowerCase();const {name,username,password,role}=req.body;const newU=String(username||old).toLowerCase();if(old==='zyen'&&newU!=='zyen')return res.status(400).json({message:'Username Master Admin tidak boleh diubah.'});const fields=['name=?','username=?','role=?'];const vals=[name,newU,role];if(password){fields.push('password_hash=?');vals.push(await bcrypt.hash(password,10));}vals.push(old);await pool.query(`UPDATE users SET ${fields.join(',')} WHERE username=?`,vals);const [u]=await pool.query(`SELECT ${publicUserColumns} FROM users WHERE username=?`,[newU]);res.json(u[0]);}catch(e){res.status(500).json({message:e.message});}});
app.delete('/api/students/:username',auth,adminOnly,async(req,res)=>{const u=String(req.params.username).toLowerCase();if(u==='zyen')return res.status(400).json({message:'Master Admin tidak dapat dihapus.'});await pool.query('DELETE FROM users WHERE username=?',[u]);res.json({message:'Akun dihapus.'});});

function publicUser(u){return {id:u.id,username:u.username,name:u.name,role:u.role,saldo:Number(u.saldo||0),bio:u.bio,status:u.status,avatar:u.avatar,banner:u.banner,frame:u.frame,pinEnabled:!!u.pin_enabled,ig:u.ig,wa:u.wa,discord:u.discord};}

(async()=>{try{await ensureSchema();await seedData();app.listen(PORT,()=>console.log(`XII C backend aktif di port ${PORT}`));}catch(e){console.error('Startup gagal:',e);process.exit(1);}})();
