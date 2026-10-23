// routes/patient.routes.js
const express = require('express');
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(verifyToken, requireRole('patient'));

// GET /api/patient/profile
router.get('/profile', (req, res) => {
  const profile = db
    .prepare(
      `SELECT pp.id as patient_id, u.name, u.email, pp.birth_date, pp.gender, pp.blood_type, pp.phone, pp.address
       FROM patient_profiles pp JOIN users u ON u.id = pp.user_id
       WHERE pp.id = ?`
    )
    .get(req.user.profileId);

  if (!profile) return res.status(404).json({ error: 'Profil introuvable.' });
  res.json(profile);
});

// GET /api/patient/consultations
router.get('/consultations', (req, res) => {
  const consultations = db
    .prepare(
      `SELECT c.id, c.date, c.reason, c.notes, u.name as doctor_name
       FROM consultations c
       JOIN doctor_profiles dp ON dp.id = c.doctor_id
       JOIN users u ON u.id = dp.user_id
       WHERE c.patient_id = ?
       ORDER BY c.date DESC`
    )
    .all(req.user.profileId);
  res.json(consultations);
});

// GET /api/patient/prescriptions
router.get('/prescriptions', (req, res) => {
  const prescriptions = db
    .prepare(
      `SELECT p.*, c.date as consultation_date, u.name as doctor_name
       FROM prescriptions p
       JOIN consultations c ON c.id = p.consultation_id
       JOIN doctor_profiles dp ON dp.id = c.doctor_id
       JOIN users u ON u.id = dp.user_id
       WHERE c.patient_id = ?
       ORDER BY p.created_at DESC`
    )
    .all(req.user.profileId);
  res.json(prescriptions);
});

// GET /api/patient/dossier  (dossier medical complet : consultations + diagnostics + prescriptions)
router.get('/dossier', (req, res) => {
  const patientId = req.user.profileId;

  const consultations = db
    .prepare(
      `SELECT c.id, c.date, c.reason, c.notes, u.name as doctor_name
       FROM consultations c
       JOIN doctor_profiles dp ON dp.id = c.doctor_id
       JOIN users u ON u.id = dp.user_id
       WHERE c.patient_id = ?
       ORDER BY c.date DESC`
    )
    .all(patientId);

  const consultationIds = consultations.map((c) => c.id);
  let diagnostics = [];
  let prescriptions = [];
  if (consultationIds.length > 0) {
    const placeholders = consultationIds.map(() => '?').join(',');
    diagnostics = db
      .prepare(`SELECT * FROM diagnostics WHERE consultation_id IN (${placeholders})`)
      .all(...consultationIds);
    prescriptions = db
      .prepare(`SELECT * FROM prescriptions WHERE consultation_id IN (${placeholders})`)
      .all(...consultationIds);
  }

  const result = consultations.map((c) => ({
    ...c,
    diagnostics: diagnostics.filter((d) => d.consultation_id === c.id),
    prescriptions: prescriptions.filter((p) => p.consultation_id === c.id),
  }));

  res.json({ consultations: result });
});

module.exports = router;
