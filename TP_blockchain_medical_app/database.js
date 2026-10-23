const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbFilePath = path.join(__dirname, 'medical_db.json');

// Structure initiale de la base de données
const initialData = {
  users: [
    { id: 1, name: 'Dr. Ali Ben Amor', email: 'ali.benamor@medecin.tn', password: '', role: 'DOCTOR' },
    { id: 2, name: 'Dr. Sara Mansour', email: 'sara.mansour@medecin.tn', password: '', role: 'DOCTOR' },
    { id: 3, name: 'Ahmed Trabelsi', email: 'ahmed.trabelsi@patient.tn', password: '', role: 'PATIENT' },
    { id: 4, name: 'Mariem Ben Salem', email: 'mariem.bensalem@patient.tn', password: '', role: 'PATIENT' }
  ],
  doctor_profiles: [
    { id: 1, user_id: 1, specialty: 'Cardiologie', phone: '+216 71 123 456' },
    { id: 2, user_id: 2, specialty: 'Médecine Générale', phone: '+216 71 789 012' }
  ],
  patient_profiles: [
    { id: 1, user_id: 3, doctor_id: 2, birth_date: '1990-05-14', gender: 'Homme', blood_type: 'O+', phone: '+216 98 111 222', address: 'Sfax, Tunisie' },
    { id: 2, user_id: 4, doctor_id: 2, birth_date: '1995-11-23', gender: 'Femme', blood_type: 'A+', phone: '+216 98 333 444', address: 'Tunis, Tunisie' }
  ],
  consultations: [
    {
      id: 1,
      patient_id: 1,
      doctor_id: 2,
      date: '2026-09-20',
      diagnostic: 'Rhinopharyngite aiguë et fièvre modérée',
      prescription: 'Paracétamol 1g (3x/jour, 5 jours), Sérum physiologique',
      notes: 'Repos recommandé, arrêt de travail de 3 jours.'
    },
    {
      id: 2,
      patient_id: 1,
      doctor_id: 2,
      date: '2026-09-25',
      diagnostic: 'Contrôle post-traitement - Rétablissement complet',
      prescription: 'Vitamine C 1000mg pendant 10 jours',
      notes: 'Constantes vitales normales, tension 12/8.'
    }
  ],
  counters: {
    users: 4,
    doctor_profiles: 2,
    patient_profiles: 2,
    consultations: 2
  }
};

// Initialiser les mots de passe hachés
const defaultDoctorHash = bcrypt.hashSync('doctor123', 10);
const defaultPatientHash = bcrypt.hashSync('patient123', 10);
initialData.users[0].password = defaultDoctorHash;
initialData.users[1].password = defaultDoctorHash;
initialData.users[2].password = defaultPatientHash;
initialData.users[3].password = defaultPatientHash;

let dataStore = initialData;

function loadDb() {
  if (fs.existsSync(dbFilePath)) {
    try {
      const raw = fs.readFileSync(dbFilePath, 'utf8');
      dataStore = JSON.parse(raw);
    } catch (e) {
      dataStore = initialData;
      saveDb();
    }
  } else {
    dataStore = initialData;
    saveDb();
  }
}

function saveDb() {
  try {
    fs.writeFileSync(dbFilePath, JSON.stringify(dataStore, null, 2), 'utf8');
  } catch (e) {
    console.error('Erreur sauvegarde DB:', e);
  }
}

loadDb();

// Moteur de requêtes compatible avec l'API SQLite (get, all, run, transaction)
class DatabaseEngine {
  pragma() {}
  exec() {}

  transaction(fn) {
    return (...args) => {
      const res = fn(...args);
      saveDb();
      return res;
    };
  }

  prepare(sql) {
    const cleanSql = sql.replace(/\s+/g, ' ').trim();

    return {
      get: (...params) => {
        loadDb();

        // 1. SELECT * FROM users WHERE email = ?
        if (cleanSql.includes('FROM users WHERE email = ?')) {
          const email = params[0];
          return dataStore.users.find(u => u.email.toLowerCase() === (email || '').toLowerCase()) || null;
        }

        // 2. SELECT id FROM users WHERE email = ? AND id != ?
        if (cleanSql.includes('FROM users WHERE email = ? AND id !=')) {
          const [email, id] = params;
          const u = dataStore.users.find(u => u.email.toLowerCase() === (email || '').toLowerCase() && u.id !== Number(id));
          return u ? { id: u.id } : null;
        }

        // 3. Doctor profile by user_id
        if (cleanSql.includes('FROM users u JOIN doctor_profiles dp') || cleanSql.includes('FROM doctor_profiles WHERE user_id = ?')) {
          const userId = Number(params[0]);
          const docProfile = dataStore.doctor_profiles.find(dp => dp.user_id === userId);
          if (!docProfile) return null;
          const user = dataStore.users.find(u => u.id === userId);
          return {
            profile_id: docProfile.id,
            user_id: userId,
            name: user ? user.name : '',
            email: user ? user.email : '',
            specialty: docProfile.specialty,
            phone: docProfile.phone
          };
        }

        // 4. Patient profile by user_id
        if (cleanSql.includes('FROM users u JOIN patient_profiles pp WHERE u.id = ?') || cleanSql.includes('FROM patient_profiles WHERE user_id = ?')) {
          const userId = Number(params[0]);
          const patProfile = dataStore.patient_profiles.find(pp => pp.user_id === userId);
          if (!patProfile) return null;
          const user = dataStore.users.find(u => u.id === userId);
          const docProfile = dataStore.doctor_profiles.find(dp => dp.id === patProfile.doctor_id);
          const docUser = docProfile ? dataStore.users.find(u => u.id === docProfile.user_id) : null;

          return {
            id: patProfile.id,
            profile_id: patProfile.id,
            user_id: userId,
            name: user ? user.name : '',
            email: user ? user.email : '',
            birth_date: patProfile.birth_date,
            gender: patProfile.gender,
            blood_type: patProfile.blood_type,
            phone: patProfile.phone,
            address: patProfile.address,
            doctor_name: docUser ? docUser.name : null,
            doctor_id: patProfile.doctor_id
          };
        }

        // 5. Patient by patientProfileId
        if (cleanSql.includes('FROM patient_profiles pp JOIN users u ON u.id = pp.user_id WHERE pp.id = ?')) {
          const patId = Number(params[0]);
          const patProfile = dataStore.patient_profiles.find(pp => pp.id === patId);
          if (!patProfile) return null;
          const user = dataStore.users.find(u => u.id === patProfile.user_id);
          return {
            patient_id: patProfile.id,
            name: user ? user.name : '',
            email: user ? user.email : '',
            birth_date: patProfile.birth_date,
            gender: patProfile.gender,
            blood_type: patProfile.blood_type,
            phone: patProfile.phone,
            address: patProfile.address
          };
        }

        return null;
      },

      all: (...params) => {
        loadDb();

        // 1. Doctor patients list
        if (cleanSql.includes('FROM patient_profiles pp') && cleanSql.includes('JOIN users u')) {
          const doctorId = params[0] !== undefined ? Number(params[0]) : null;
          let list = dataStore.patient_profiles;
          if (doctorId) {
            list = list.filter(pp => pp.doctor_id === doctorId || !pp.doctor_id);
          }

          return list.map(pp => {
            const user = dataStore.users.find(u => u.id === pp.user_id);
            const count = dataStore.consultations.filter(c => c.patient_id === pp.id).length;
            return {
              profile_id: pp.id,
              user_id: pp.user_id,
              name: user ? user.name : '',
              email: user ? user.email : '',
              birth_date: pp.birth_date,
              gender: pp.gender,
              blood_type: pp.blood_type,
              phone: pp.phone,
              address: pp.address,
              consultation_count: count
            };
          });
        }

        // 2. Patient consultations
        if (cleanSql.includes('FROM consultations c') && cleanSql.includes('WHERE c.patient_id = ?')) {
          const patId = Number(params[0]);
          const consults = dataStore.consultations
            .filter(c => c.patient_id === patId)
            .sort((a, b) => b.id - a.id);

          return consults.map(c => {
            const docProf = dataStore.doctor_profiles.find(dp => dp.id === c.doctor_id);
            const docUser = docProf ? dataStore.users.find(u => u.id === docProf.user_id) : null;
            return {
              ...c,
              doctor_name: docUser ? docUser.name : 'Dr. Inconnu'
            };
          });
        }

        // 3. Doctors list for selects
        if (cleanSql.includes('FROM doctor_profiles dp JOIN users u')) {
          return dataStore.doctor_profiles.map(dp => {
            const user = dataStore.users.find(u => u.id === dp.user_id);
            return {
              doctor_id: dp.id,
              profile_id: dp.id,
              name: user ? user.name : '',
              specialty: dp.specialty
            };
          });
        }

        return [];
      },

      run: (...params) => {
        // 1. UPDATE users SET name = ?, email = ? ...
        if (cleanSql.startsWith('UPDATE users SET')) {
          if (cleanSql.includes('password = ?')) {
            const [name, email, password, userId] = params;
            const u = dataStore.users.find(u => u.id === Number(userId));
            if (u) {
              u.name = name;
              u.email = email;
              u.password = password;
            }
          } else {
            const [name, email, userId] = params;
            const u = dataStore.users.find(u => u.id === Number(userId));
            if (u) {
              u.name = name;
              u.email = email;
            }
          }
          saveDb();
          return { changes: 1 };
        }

        // 2. UPDATE patient_profiles SET doctor_id = ?
        if (cleanSql.startsWith('UPDATE patient_profiles SET')) {
          const [docId, userId] = params;
          const pp = dataStore.patient_profiles.find(p => p.user_id === Number(userId));
          if (pp) {
            pp.doctor_id = Number(docId);
          }
          saveDb();
          return { changes: 1 };
        }

        // 3. INSERT INTO consultations
        if (cleanSql.startsWith('INSERT INTO consultations')) {
          const [patient_id, doctor_id, date, diagnostic, prescription, notes] = params;
          dataStore.counters.consultations += 1;
          const newId = dataStore.counters.consultations;
          const newCons = {
            id: newId,
            patient_id: Number(patient_id),
            doctor_id: Number(doctor_id),
            date,
            diagnostic,
            prescription,
            notes
          };
          dataStore.consultations.push(newCons);
          saveDb();
          return { lastInsertRowid: newId };
        }

        // 4. INSERT INTO users
        if (cleanSql.startsWith('INSERT INTO users')) {
          const [name, email, password, role] = params;
          dataStore.counters.users += 1;
          const newId = dataStore.counters.users;
          dataStore.users.push({ id: newId, name, email, password, role });
          saveDb();
          return { lastInsertRowid: newId };
        }

        return { lastInsertRowid: 1, changes: 1 };
      }
    };
  }
}

module.exports = new DatabaseEngine();
