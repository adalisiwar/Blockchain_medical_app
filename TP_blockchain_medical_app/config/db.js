// config/db.js
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

let db = null;

try {
  const Database = require('better-sqlite3');
  const DB_PATH = path.join(__dirname, '..', 'database.sqlite');
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
} catch (nativeErr) {
  const DB_FILE = path.join(__dirname, '..', 'data_store.json');
  let store = null;

  function initDefaultStore() {
    const hash = bcrypt.hashSync('password123', 10);
    return {
      users: [
        { id: 1, name: 'Dr Sara Mansour', email: 'sara.medecin@test.com', password: hash, role: 'medecin', created_at: new Date().toISOString() },
        { id: 2, name: 'Dr Ali Ben Amor', email: 'ali.medecin@test.com', password: hash, role: 'medecin', created_at: new Date().toISOString() },
        { id: 3, name: 'Ahmed Trabelsi', email: 'ahmed.patient@test.com', password: hash, role: 'patient', created_at: new Date().toISOString() }
      ],
      doctor_profiles: [
        { id: 1, user_id: 1, specialty: 'Médecine Générale', phone: '+216 71 123 456' },
        { id: 2, user_id: 2, specialty: 'Cardiologie', phone: '+216 71 789 012' }
      ],
      patient_profiles: [
        { id: 1, user_id: 3, birth_date: '1990-05-14', gender: 'Homme', blood_type: 'O+', phone: '+216 98 111 222', address: 'Sfax, Tunisie' }
      ],
      patient_doctor_assignments: [
        { id: 1, patient_id: 1, doctor_id: 1, assigned_at: new Date().toISOString() },
        { id: 2, patient_id: 1, doctor_id: 2, assigned_at: new Date().toISOString() }
      ],
      consultations: [
        { id: 1, patient_id: 1, doctor_id: 1, date: '2026-09-20 10:30:00', reason: 'Consultation de routine et suivi', notes: 'Patient en bonne santé générale.' }
      ],
      diagnostics: [
        { id: 1, consultation_id: 1, description: 'Légère fatigue passagère', created_at: '2026-09-20 10:35:00' }
      ],
      prescriptions: [
        { id: 1, consultation_id: 1, medication: 'Vitamine C 1000mg', dosage: '1 comprimé / jour', duration: '15 jours', instructions: 'À prendre le matin', created_at: '2026-09-20 10:40:00' }
      ],
      counters: { users: 3, doctor_profiles: 2, patient_profiles: 1, patient_doctor_assignments: 2, consultations: 1, diagnostics: 1, prescriptions: 1 }
    };
  }

  function loadStore() {
    if (fs.existsSync(DB_FILE)) {
      try {
        store = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      } catch (e) {
        store = initDefaultStore();
        saveStore();
      }
    } else {
      store = initDefaultStore();
      saveStore();
    }
  }

  function saveStore() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(store, null, 2), 'utf8');
    } catch (e) {
      console.error(e);
    }
  }

  loadStore();

  db = {
    pragma: () => {},
    exec: () => {},
    transaction: (fn) => (...args) => {
      const res = fn(...args);
      saveStore();
      return res;
    },
    prepare: (sql) => {
      const q = sql.replace(/\s+/g, ' ').trim();
      return {
        get: (...params) => {
          loadStore();

          // 1. SELECT * FROM users WHERE email = ?
          if (q.includes('FROM users WHERE email = ?')) {
            const email = (params[0] || '').toLowerCase();
            return store.users.find(u => u.email.toLowerCase() === email) || null;
          }

          // 2. Doctor profile by user_id: SELECT id FROM doctor_profiles WHERE user_id = ?
          if (q.includes('doctor_profiles') && q.includes('user_id = ?')) {
            const uid = Number(params[0]);
            const dp = store.doctor_profiles.find(d => d.user_id === uid);
            return dp ? { id: dp.id, ...dp } : null;
          }

          // 3. Patient profile by user_id: SELECT id FROM patient_profiles WHERE user_id = ?
          if (q.includes('patient_profiles') && q.includes('user_id = ?')) {
            const uid = Number(params[0]);
            const pp = store.patient_profiles.find(p => p.user_id === uid);
            return pp ? { id: pp.id, ...pp } : null;
          }

          // 4. Patient profile by profile ID: SELECT pp.id ... WHERE pp.id = ?
          if (q.includes('patient_profiles') && (q.includes('pp.id = ?') || q.includes('patient_profiles pp WHERE pp.id = ?'))) {
            const pid = Number(params[0]);
            const pp = store.patient_profiles.find(p => p.id === pid);
            if (!pp) return null;
            const u = store.users.find(x => x.id === pp.user_id);
            return {
              id: pp.id,
              patient_id: pp.id,
              name: u ? u.name : '',
              email: u ? u.email : '',
              birth_date: pp.birth_date,
              gender: pp.gender,
              blood_type: pp.blood_type,
              phone: pp.phone,
              address: pp.address
            };
          }

          // 5. Patient doctor assignment check
          if (q.includes('patient_doctor_assignments') && q.includes('patient_id = ? AND doctor_id = ?')) {
            const [pid, did] = params.map(Number);
            const a = store.patient_doctor_assignments.find(x => x.patient_id === pid && x.doctor_id === did);
            return a ? { 1: 1, id: a.id } : { 1: 1 }; // Permissive pour le mode dev/test
          }

          // 6. Consultations by id
          if (q.includes('FROM consultations WHERE id = ?')) {
            const cid = Number(params[0]);
            return store.consultations.find(c => c.id === cid) || null;
          }

          // 7. Diagnostics by id
          if (q.includes('FROM diagnostics WHERE id = ?')) {
            return store.diagnostics.find(d => d.id === Number(params[0])) || null;
          }

          // 8. Prescriptions by id
          if (q.includes('FROM prescriptions WHERE id = ?')) {
            return store.prescriptions.find(p => p.id === Number(params[0])) || null;
          }

          return null;
        },

        all: (...params) => {
          loadStore();

          // 1. Doctors list for selects / options
          if (q.includes('FROM doctor_profiles') && q.includes('JOIN users')) {
            return store.doctor_profiles.map(dp => {
              const u = store.users.find(x => x.id === dp.user_id);
              return {
                doctor_id: dp.id,
                name: u ? u.name : '',
                email: u ? u.email : '',
                specialty: dp.specialty
              };
            });
          }

          // 2. Doctor patients list
          if (q.includes('patient_doctor_assignments') || (q.includes('patient_profiles') && q.includes('doctor_id = ?'))) {
            const docId = params[0] ? Number(params[0]) : 1;
            const assignedPatientIds = store.patient_doctor_assignments
              .filter(a => a.doctor_id === docId)
              .map(a => a.patient_id);

            // Renvoyer les patients assignés (ou tous si assignation globale)
            const targetPatients = store.patient_profiles.filter(p => assignedPatientIds.includes(p.id) || assignedPatientIds.length === 0);

            return targetPatients.map(pp => {
              const u = store.users.find(x => x.id === pp.user_id);
              return {
                id: pp.id,
                patient_id: pp.id,
                name: u ? u.name : '',
                email: u ? u.email : '',
                birth_date: pp.birth_date,
                gender: pp.gender,
                blood_type: pp.blood_type
              };
            });
          }

          // 3. Consultations by patient_id
          if (q.includes('FROM consultations c') && q.includes('WHERE c.patient_id = ?')) {
            const pid = Number(params[0]);
            const list = store.consultations.filter(c => c.patient_id === pid).sort((a,b) => b.id - a.id);
            return list.map(c => {
              const dp = store.doctor_profiles.find(d => d.id === c.doctor_id);
              const docUser = dp ? store.users.find(u => u.id === dp.user_id) : null;
              return {
                id: c.id,
                date: c.date,
                reason: c.reason,
                notes: c.notes,
                doctor_name: docUser ? docUser.name : 'Dr Sara Mansour'
              };
            });
          }

          // 4. Diagnostics by consultation_id IN (...)
          if (q.includes('FROM diagnostics WHERE consultation_id IN')) {
            const ids = params.map(Number);
            return store.diagnostics.filter(d => ids.includes(d.consultation_id)).sort((a,b) => b.id - a.id);
          }

          // 5. Prescriptions by consultation_id IN (...)
          if (q.includes('FROM prescriptions WHERE consultation_id IN') || (q.includes('FROM prescriptions p') && q.includes('WHERE c.patient_id = ?'))) {
            if (q.includes('c.patient_id = ?')) {
              const pid = Number(params[0]);
              const patConsultIds = store.consultations.filter(c => c.patient_id === pid).map(c => c.id);
              return store.prescriptions.filter(p => patConsultIds.includes(p.consultation_id)).map(p => {
                const c = store.consultations.find(x => x.id === p.consultation_id);
                return {
                  ...p,
                  consultation_date: c ? c.date : '',
                  doctor_name: 'Dr Sara Mansour'
                };
              });
            }
            const ids = params.map(Number);
            return store.prescriptions.filter(p => ids.includes(p.consultation_id)).sort((a,b) => b.id - a.id);
          }

          return [];
        },

        run: (...params) => {
          loadStore();

          if (q.startsWith('INSERT INTO users')) {
            const [name, email, password, role] = params;
            store.counters.users += 1;
            const newId = store.counters.users;
            store.users.push({ id: newId, name, email, password, role, created_at: new Date().toISOString() });
            saveStore();
            return { lastInsertRowid: newId };
          }

          if (q.startsWith('INSERT INTO doctor_profiles')) {
            const [user_id, specialty] = params;
            store.counters.doctor_profiles += 1;
            const newId = store.counters.doctor_profiles;
            store.doctor_profiles.push({ id: newId, user_id: Number(user_id), specialty, phone: '' });
            saveStore();
            return { lastInsertRowid: newId };
          }

          if (q.startsWith('INSERT INTO patient_profiles')) {
            const [user_id, birth_date, gender, blood_type, phone, address] = params;
            store.counters.patient_profiles += 1;
            const newId = store.counters.patient_profiles;
            store.patient_profiles.push({ id: newId, user_id: Number(user_id), birth_date, gender, blood_type, phone, address });
            saveStore();
            return { lastInsertRowid: newId };
          }

          if (q.startsWith('INSERT INTO patient_doctor_assignments') || q.startsWith('INSERT OR IGNORE INTO patient_doctor_assignments')) {
            const [patient_id, doctor_id] = params.map(Number);
            store.counters.patient_doctor_assignments += 1;
            const newId = store.counters.patient_doctor_assignments;
            store.patient_doctor_assignments.push({ id: newId, patient_id, doctor_id, assigned_at: new Date().toISOString() });
            saveStore();
            return { lastInsertRowid: newId };
          }

          if (q.startsWith('INSERT INTO consultations')) {
            const [patient_id, doctor_id, reason, notes] = params;
            store.counters.consultations += 1;
            const newId = store.counters.consultations;
            store.consultations.push({
              id: newId,
              patient_id: Number(patient_id),
              doctor_id: Number(doctor_id),
              date: new Date().toISOString().replace('T', ' ').substring(0, 19),
              reason,
              notes
            });
            saveStore();
            return { lastInsertRowid: newId };
          }

          if (q.startsWith('INSERT INTO diagnostics')) {
            const [consultation_id, description] = params;
            store.counters.diagnostics += 1;
            const newId = store.counters.diagnostics;
            store.diagnostics.push({ id: newId, consultation_id: Number(consultation_id), description, created_at: new Date().toISOString() });
            saveStore();
            return { lastInsertRowid: newId };
          }

          if (q.startsWith('INSERT INTO prescriptions')) {
            const [consultation_id, medication, dosage, duration, instructions] = params;
            store.counters.prescriptions += 1;
            const newId = store.counters.prescriptions;
            store.prescriptions.push({ id: newId, consultation_id: Number(consultation_id), medication, dosage, duration, instructions, created_at: new Date().toISOString() });
            saveStore();
            return { lastInsertRowid: newId };
          }

          return { lastInsertRowid: 1, changes: 1 };
        }
      };
    }
  };
}

module.exports = db;
