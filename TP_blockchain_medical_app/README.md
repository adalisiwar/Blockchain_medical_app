# Dossier Médical — Application Web (Médecin / Patient)

Application simple de gestion de dossiers médicaux (Médecin / Patient).
La blockchain n'est volontairement pas intégrée pour l'instant — le
code est structuré (routes/services séparés) pour pouvoir l'ajouter
plus tard sans tout réécrire, mais rien n'y fait référence aujourd'hui.

## Stack technique

- **Frontend** : HTML / CSS / JavaScript (vanilla, sans framework)
- **Backend** : Node.js + Express
- **Base de données** : SQLite (via `better-sqlite3`)
- **API** : REST (JSON)
- **Authentification** : JWT (JSON Web Token)

## Installation

```bash
cd medical-app
npm install
npm start
```

L'application est ensuite accessible sur : http://localhost:3000


## Structure du projet

```
medical-app/
├── server.js                 # point d'entrée Express
├── config/db.js              # connexion SQLite + schéma des tables
├── middleware/auth.js        # vérification JWT + contrôle de rôle
├── utils/password.js         # hachage bcrypt des mots de passe
├── routes/
│   ├── auth.routes.js        # /api/auth (register, login)
│   ├── doctor.routes.js      # /api/doctor (patients, consultations, diagnostics, prescriptions)
│   └── patient.routes.js     # /api/patient (profil, dossier, consultations, prescriptions)
└── public/                   # frontend (HTML/CSS/JS)
    ├── index.html             # connexion / inscription
    ├── doctor/                # espace médecin
    └── patient/               # espace patient
```

## Fonctionnalités

### Médecin
- Connexion
- Liste de ses patients
- Consultation du dossier médical complet d'un patient
- Ajout d'une consultation
- Ajout d'un diagnostic (rattaché à une consultation)
- Ajout d'une prescription (rattachée à une consultation)
- Consultation de l'historique médical

### Patient
- Connexion
- Consultation de son profil
- Consultation de son dossier médical
- Consultation de ses consultations
- Consultation de ses prescriptions