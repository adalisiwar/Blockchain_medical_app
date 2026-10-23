# Blockchain Medical App

A medical-record management project with a web application for doctors and patients, alongside an Ethereum smart contract prototype for recording and verifying medical-record hashes.

> **Project status:** The web application and Ethereum contract are separate components. The web application does not currently submit records to the blockchain.

## Features

### Medical web application

- Doctor and patient registration and login
- Doctor access to assigned patients and their medical history
- Creation of consultations, diagnoses, and prescriptions
- Patient access to their profile, consultations, and prescriptions
- REST API built with Express and a browser-based interface
- Local persistence using SQLite when `better-sqlite3` is available, with a JSON-file fallback

### Ethereum contract

The Solidity `MedicalRecord` contract supports:

- Recording a patient's medical-record hash and timestamp
- Retrieving a patient's latest or historical record hash
- Checking a supplied hash against the latest recorded hash
- Counting a patient's record versions

Only hashes should be recorded on-chain. Do not put patient names, medical notes, or other personal health information on a public blockchain.

## Technology

- **Web app:** Node.js, Express, JavaScript, HTML, CSS
- **Authentication:** JSON Web Tokens and `bcryptjs`
- **Blockchain:** Solidity, Hardhat 3, TypeScript, ethers.js

## Repository layout

```text
.
├── Ethereum/
│   ├── contracts/MedicalRecord.sol
│   ├── test/
│   ├── scripts/
│   └── hardhat.config.ts
└── TP_blockchain_medical_app/
    ├── server.js
    ├── config/
    ├── routes/
    ├── middleware/
    ├── utils/
    └── public/
```

## Prerequisites

- Node.js and npm
- For blockchain deployment to Sepolia: a Sepolia RPC URL and a funded test account

## Run the medical web application

```powershell
cd TP_blockchain_medical_app
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000). The health endpoint is available at [http://localhost:3000/health](http://localhost:3000/health).

The app reads configuration from a local `.env` file. Set a unique `JWT_SECRET` before using the app beyond local development. Never commit `.env` files or real credentials.

Local database files and application data are created on the machine running the app; they are not included in this repository.

## Test the smart contract

```powershell
cd Ethereum
npm install
npx hardhat test
```

## Deploy to Sepolia

Configure the Hardhat variables `SEPOLIA_RPC_URL` and `SEPOLIA_PRIVATE_KEY`, for example with Hardhat's keystore. Never commit private keys or other secrets.

From the `Ethereum/` directory, deploy `MedicalRecord` with:

```powershell
npx hardhat run scripts/deploy.ts --network sepolia
```

## Security and privacy

- Keep `.env` files, private keys, and credentials out of version control.
- Do not use real patient data for development or testing.
- This project is a prototype and is not a substitute for a security, privacy, or regulatory review before handling real health information.
