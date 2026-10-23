// routes/auth.routes.js
const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { hashPassword, comparePassword } = require('../utils/password');

const router = express.Router();

function signToken(user, profileId) {
  const secret = process.env.JWT_SECRET || 'super_secret_jwt_key_tp_medical_blockchain';
  return jwt.sign(
    { id: user.id, role: user.role, name: user.name, profileId },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

router.get('/doctors', (req, res) => {
  const doctors = db
    .prepare(
      `SELECT dp.id AS doctor_id, u.name, u.email, dp.specialty
       FROM doctor_profiles dp
       JOIN users u ON u.id = dp.user_id
       ORDER BY u.name ASC`
    )
    .all();

  res.json(doctors);
});

// POST /api/auth/register
// body: { name, email, password, role: 'medecin'|'patient', specialty?, birth_date?, gender?, assigned_doctor_id? }
router.post('/register', (req, res) => {
  const { name, email, password, role, specialty, birth_date, gender, assigned_doctor_id } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Champs requis manquants.' });
  }
  if (!['medecin', 'patient'].includes(role)) {
    return res.status(400).json({ error: 'Role invalide.' });
  }
  if (role === 'patient' && birth_date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birth_date)) {
      return res.status(400).json({ error: 'La date de naissance est invalide.' });
    }

    const birthDate = new Date(`${birth_date}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [year, month, day] = birth_date.split('-').map(Number);
    if (
      Number.isNaN(birthDate.getTime()) ||
      birthDate.getFullYear() !== year ||
      birthDate.getMonth() !== month - 1 ||
      birthDate.getDate() !== day
    ) {
      return res.status(400).json({ error: 'La date de naissance est invalide.' });
    }
    if (birthDate > today) {
      return res.status(400).json({ error: 'La date de naissance ne peut pas etre dans le futur.' });
    }
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'Un compte existe deja avec cet email.' });
  }

  const hashed = hashPassword(password);
  const insertUser = db.prepare(
    'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)'
  );
  const info = insertUser.run(name, email, hashed, role);
  const userId = info.lastInsertRowid;

  let profileId;
  if (role === 'medecin') {
    const info2 = db
      .prepare('INSERT INTO doctor_profiles (user_id, specialty) VALUES (?, ?)')
      .run(userId, specialty || null);
    profileId = info2.lastInsertRowid;
  } else {
    const doctorId = Number(assigned_doctor_id);
    if (!doctorId || !db.prepare('SELECT id FROM doctor_profiles WHERE id = ?').get(doctorId)) {
      return res.status(400).json({ error: 'Veuillez choisir un medecin valide.' });
    }

    const info2 = db
      .prepare('INSERT INTO patient_profiles (user_id, birth_date, gender) VALUES (?, ?, ?)')
      .run(userId, birth_date || null, gender || null);
    profileId = info2.lastInsertRowid;

    db.prepare(
      'INSERT INTO patient_doctor_assignments (patient_id, doctor_id) VALUES (?, ?)'
    ).run(profileId, doctorId);
  }

  const user = { id: userId, role, name };
  const token = signToken(user, profileId);
  res.status(201).json({ token, user: { id: userId, name, email, role, profileId } });
});

// POST /api/auth/login
// body: { email, password }
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !comparePassword(password, user.password)) {
    return res.status(401).json({ error: 'Identifiants incorrects.' });
  }

  let profileId;
  if (user.role === 'medecin') {
    const p = db.prepare('SELECT id FROM doctor_profiles WHERE user_id = ?').get(user.id);
    profileId = p ? p.id : null;
  } else {
    const p = db.prepare('SELECT id FROM patient_profiles WHERE user_id = ?').get(user.id);
    profileId = p ? p.id : null;
  }

  const token = signToken(user, profileId);
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, profileId },
  });
});

module.exports = router;
