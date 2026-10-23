// public/doctor/js/patient.js
requireRole('medecin');
document.getElementById('doctorName').textContent = 'Dr ' + (localStorage.getItem('name') || '');

const params = new URLSearchParams(window.location.search);
const patientId = params.get('id');
if (!patientId) window.location.href = 'dashboard.html';

document.getElementById('bcPatientId').textContent = patientId;

// ==========================================
// CONFIGURATION SMART CONTRACT ETHEREUM
// ==========================================
const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const CONTRACT_ABI = [
  "function addRecord(uint256 _patientId, string memory _recordHash) public",
  "function getLastRecord(uint256 _patientId) public view returns (string memory recordHash, uint256 timestamp)",
  "function getRecordCount(uint256 _patientId) public view returns (uint256)",
  "function verifyIntegrity(uint256 _patientId, string memory _hashToVerify) public view returns (bool)",
  "event RecordAdded(uint256 indexed patientId, string recordHash, uint256 timestamp)"
];

let currentDossier = null;
let currentLocalHash = "";
let provider = null;
let signer = null;
let medicalContract = null;

// ==========================================
let isSettingUpWallet = false;

function getProvider() {
  if (!provider && window.ethereum) {
    provider = new ethers.BrowserProvider(window.ethereum, "any");
  }
  return provider;
}

// ==========================================
// INITIALISATION AU CHARGEMENT DE LA PAGE
// ==========================================
window.addEventListener('DOMContentLoaded', async () => {
  await loadDossier();

  if (window.ethereum) {
    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts && accounts.length > 0) {
        await setupWallet();
      }
    } catch (e) {
      console.log("Vérification comptes MetaMask :", e);
    }

    window.ethereum.on('accountsChanged', async (accounts) => {
      if (accounts && accounts.length > 0) {
        await setupWallet();
      } else {
        resetWalletUI();
      }
    });

    window.ethereum.on('chainChanged', async () => {
      // Attendre un bref instant pour que MetaMask se stabilise
      setTimeout(() => {
        setupWallet();
      }, 300);
    });
  } else {
    document.getElementById('bcAccount').innerHTML = '<span style="color:red;">MetaMask non détecté</span>';
  }
});

// ==========================================
// 1. CHARGEMENT DU DOSSIER PATIENT & HASH
// ==========================================
async function loadDossier() {
  try {
    const dossier = await apiFetch(`/api/doctor/patients/${patientId}/dossier`);
    currentDossier = dossier;
    renderPatientInfo(dossier.patient);
    renderHistory(dossier.consultations);
    renderConsultationSelect(dossier.consultations);

    // Calcul du Hash Keccak-256 du dossier médical local
    updateLocalHash();

    // Actualiser le statut On-Chain si connecté
    if (medicalContract) {
      await refreshBlockchainData();
    }
  } catch (err) {
    alert(err.message);
  }
}

function updateLocalHash() {
  if (!currentDossier) return;

  const canonicalData = {
    patient_id: currentDossier.patient.patient_id,
    name: currentDossier.patient.name,
    email: currentDossier.patient.email,
    birth_date: currentDossier.patient.birth_date,
    gender: currentDossier.patient.gender,
    blood_type: currentDossier.patient.blood_type,
    consultations: (currentDossier.consultations || []).map(c => ({
      id: c.id,
      date: c.date,
      reason: c.reason,
      notes: c.notes,
      diagnostics: (c.diagnostics || []).map(d => ({ id: d.id, description: d.description })),
      prescriptions: (c.prescriptions || []).map(p => ({
        id: p.id,
        medication: p.medication,
        dosage: p.dosage,
        duration: p.duration,
        instructions: p.instructions
      }))
    }))
  };

  const jsonStr = JSON.stringify(canonicalData);
  if (window.ethers) {
    currentLocalHash = ethers.keccak256(ethers.toUtf8Bytes(jsonStr));
  } else {
    currentLocalHash = "Erreur Ethers.js";
  }

  document.getElementById('bcLocalHash').textContent = currentLocalHash;
}

function renderPatientInfo(patient) {
  document.getElementById('patientName').textContent = patient.name;
  document.getElementById('patientDetails').textContent =
    `${patient.email} · Né(e) le ${patient.birth_date || 'N/A'} · ${patient.gender || ''} ${patient.blood_type ? '· Groupe: ' + patient.blood_type : ''}`;
}

function renderConsultationSelect(consultations) {
  const select = document.getElementById('targetConsultation');
  select.innerHTML = '';
  if (consultations.length === 0) {
    select.innerHTML = '<option value="">Aucune consultation - créez-en une d\'abord</option>';
    return;
  }
  consultations.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${formatDate(c.date)} — ${c.reason || 'Sans motif'}`;
    select.appendChild(opt);
  });
}

function renderHistory(consultations) {
  const container = document.getElementById('historyContainer');
  container.innerHTML = '';

  if (consultations.length === 0) {
    container.innerHTML = '<div class="empty-state">Aucune consultation enregistrée.</div>';
    return;
  }

  consultations.forEach((c) => {
    const block = document.createElement('div');
    block.className = 'consultation-block';

    let diagnosticsHtml = c.diagnostics.length
      ? '<ul class="sub-list">' + c.diagnostics.map(d => `<li>🩺 ${d.description}</li>`).join('') + '</ul>'
      : '<p style="font-size:13px;color:#94a3b8;">Aucun diagnostic.</p>';

    let prescriptionsHtml = c.prescriptions.length
      ? '<ul class="sub-list">' + c.prescriptions.map(p =>
          `<li>💊 <strong>${p.medication}</strong> ${p.dosage ? '- ' + p.dosage : ''} ${p.duration ? '(' + p.duration + ')' : ''}${p.instructions ? '<br><em>' + p.instructions + '</em>' : ''}</li>`
        ).join('') + '</ul>'
      : '<p style="font-size:13px;color:#94a3b8;">Aucune prescription.</p>';

    block.innerHTML = `
      <div class="consultation-header">
        <span class="date">${formatDate(c.date)}</span>
      </div>
      <p><strong>Motif:</strong> ${c.reason || '-'}</p>
      <p><strong>Notes:</strong> ${c.notes || '-'}</p>
      <p><strong>Diagnostics</strong></p>
      ${diagnosticsHtml}
      <p><strong>Prescriptions</strong></p>
      ${prescriptionsHtml}
    `;
    container.appendChild(block);
  });
}

// ==========================================
// 2. CONNEXION METAMASK & GESTION WEB3
// ==========================================
async function connectWallet() {
  if (!window.ethereum) {
    alert("MetaMask n'est pas détecté. Veuillez installer l'extension MetaMask pour votre navigateur !");
    return;
  }

  try {
    await window.ethereum.request({ method: 'eth_requestAccounts' });

    const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
    const chainId = parseInt(chainIdHex, 16);

    if (chainId !== 31337 && chainId !== 1337) {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x7a69' }],
        });
      } catch (switchError) {
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x7a69',
              chainName: 'Hardhat Localhost',
              rpcUrls: ['http://127.0.0.1:8545'],
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }
            }],
          });
        }
      }
    }

    provider = new ethers.BrowserProvider(window.ethereum, "any");
    await setupWallet();
  } catch (err) {
    console.error("Erreur connectWallet:", err);
  }
}

async function setupWallet() {
  if (isSettingUpWallet) return;
  isSettingUpWallet = true;

  try {
    if (!window.ethereum) return;

    // Obtenir le Chain ID réel directement depuis MetaMask (sans cache intermédiaire)
    const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
    const chainId = parseInt(chainIdHex, 16);
    const isHardhat = (chainId === 31337 || chainId === 1337);

    const prov = getProvider();
    signer = await prov.getSigner().catch(() => null);
    if (!signer) {
      resetWalletUI();
      return;
    }

    const address = await signer.getAddress();
    document.getElementById('bcAccount').innerHTML = `<span class="bc-badge bc-badge-connected">${address.substring(0, 6)}...${address.substring(38)}</span>`;

    if (isHardhat) {
      document.getElementById('bcNetwork').innerHTML = `<span style="color: #16a34a; font-weight: bold;">Hardhat Localhost (31337)</span>`;
      document.getElementById('btnConnectWallet').textContent = '🦊 Connecté';
      document.getElementById('btnConnectWallet').className = 'btn btn-success btn-small';

      medicalContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      await refreshBlockchainData();
    } else {
      document.getElementById('bcNetwork').innerHTML = `<span style="color: #dc2626; font-weight: bold;">Réseau: Mainnet / Autre (ChainID: ${chainId}) — Requis: 31337</span>`;
      document.getElementById('btnConnectWallet').textContent = '⚠️ Basculer sur 31337';
      document.getElementById('btnConnectWallet').className = 'btn btn-metamask btn-small';
      medicalContract = null;
      document.getElementById('bcOnChainHash').textContent = "Veuillez connecter MetaMask au réseau Hardhat (31337)";
    }
  } catch (err) {
    console.error("Erreur setupWallet:", err);
  } finally {
    isSettingUpWallet = false;
  }
}

function resetWalletUI() {
  signer = null;
  medicalContract = null;
  document.getElementById('bcAccount').textContent = 'Non connecté';
  document.getElementById('bcNetwork').textContent = 'Inconnu';
  document.getElementById('btnConnectWallet').textContent = '🦊 Connecter MetaMask';
  document.getElementById('btnConnectWallet').className = 'btn btn-metamask btn-small';
}

// ==========================================
// 3. STATUT BLOCKCHAIN (ON-CHAIN)
// ==========================================
async function refreshBlockchainData() {
  if (!medicalContract) return;

  try {
    const countBigInt = await medicalContract.getRecordCount(BigInt(patientId));
    const count = Number(countBigInt);
    document.getElementById('bcRecordCount').textContent = `${count} version(s)`;

    if (count > 0) {
      const [lastHash, timestampBigInt] = await medicalContract.getLastRecord(BigInt(patientId));
      const date = new Date(Number(timestampBigInt) * 1000);

      document.getElementById('bcOnChainHash').textContent = lastHash;
      document.getElementById('bcLastTimestamp').textContent = date.toLocaleString('fr-FR');
    } else {
      document.getElementById('bcOnChainHash').textContent = "Aucun hash enregistré sur la blockchain";
      document.getElementById('bcLastTimestamp').textContent = "Dossier non encore ancré";
    }
  } catch (err) {
    console.error("Erreur lecture smart contract :", err);
    document.getElementById('bcOnChainHash').textContent = "Erreur lecture on-chain (vérifier adresse et nœud Hardhat)";
  }
}

// ==========================================
// 4. ACTION : ENREGISTRER SUR LA BLOCKCHAIN
// ==========================================
async function saveRecordToBlockchain() {
  if (!medicalContract || !signer) {
    alert("Veuillez d'abord connecter votre portefeuille MetaMask !");
    await connectWallet();
    if (!medicalContract) return;
  }

  const txBox = document.getElementById('txStatusBox');
  txBox.style.display = 'block';
  txBox.className = 'alert-box alert-box-info';
  txBox.innerHTML = '⏳ <strong>Transaction en cours...</strong> Veuillez confirmer l\'opération dans MetaMask.';

  try {
    updateLocalHash();

    // Appel de addRecord(patientId, hash) sur le smart contract
    const tx = await medicalContract.addRecord(BigInt(patientId), currentLocalHash);

    txBox.innerHTML = `📡 <strong>Transaction diffusée :</strong> <code style="font-size:12px;">${tx.hash}</code><br>Attente de minage du bloc Ethereum...`;

    const receipt = await tx.wait();

    txBox.className = 'alert-box alert-box-success';
    txBox.innerHTML = `✅ <strong>Dossier enregistré avec succès sur la blockchain !</strong><br>Bloc miné : <strong>#${receipt.blockNumber}</strong> | Tx Hash : <code style="font-size:12px;">${receipt.hash}</code>`;

    await refreshBlockchainData();
    await verifyRecordIntegrity();
  } catch (err) {
    console.error(err);
    txBox.className = 'alert-box alert-box-danger';
    txBox.innerHTML = `❌ <strong>Erreur transaction :</strong> ${err.reason || err.message}`;
  }
}

// ==========================================
// 5. ACTION : VÉRIFIER L'INTÉGRITÉ
// ==========================================
async function verifyRecordIntegrity() {
  const resultBox = document.getElementById('integrityResultBox');
  resultBox.style.display = 'block';

  if (!medicalContract) {
    resultBox.className = 'alert-box alert-box-info';
    resultBox.innerHTML = '⚠️ Veuillez connecter MetaMask pour vérifier l\'intégrité sur la blockchain.';
    return;
  }

  try {
    updateLocalHash();

    const countBigInt = await medicalContract.getRecordCount(BigInt(patientId));
    if (Number(countBigInt) === 0) {
      resultBox.className = 'alert-box alert-box-info';
      resultBox.innerHTML = `ℹ️ <strong>Aucun enregistrement trouvé :</strong> Ce dossier patient n'a pas encore été ancré sur la blockchain Ethereum. Cliquez sur « Enregistrer le dossier sur la blockchain » pour créer le premier ancrage.`;
      return;
    }

    // Appel de la méthode verifyIntegrity du smart contract
    const isIntact = await medicalContract.verifyIntegrity(BigInt(patientId), currentLocalHash);

    if (isIntact) {
      resultBox.className = 'alert-box alert-box-success';
      resultBox.innerHTML = `
        <div>✅ <strong>Intégrité vérifiée :</strong> Le dossier local correspond exactement à la version immuable sur la blockchain Ethereum.</div>
        <div style="font-size:12px; margin-top:4px; font-family:monospace;">Hash vérifié : ${currentLocalHash}</div>
      `;
    } else {
      const [lastHash] = await medicalContract.getLastRecord(BigInt(patientId));
      resultBox.className = 'alert-box alert-box-danger';
      resultBox.innerHTML = `
        <div>⚠️ <strong>Intégrité compromise :</strong> Le dossier médical a été modifié localement depuis son dernier enregistrement sur la blockchain !</div>
        <div style="font-size:12px; margin-top:6px; font-family:monospace;">
          <strong>Dernier Hash Blockchain :</strong> ${lastHash}<br>
          <strong>Hash Local Actuel :</strong> ${currentLocalHash}
        </div>
      `;
    }
  } catch (err) {
    console.error(err);
    resultBox.className = 'alert-box alert-box-danger';
    resultBox.innerHTML = `❌ <strong>Erreur lors de la vérification :</strong> ${err.message}`;
  }
}

// ==========================================
// 6. FORMULAIRES DE CONSULTATION / DIAG / PRESC
// ==========================================
document.getElementById('consultationForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('consultationError');
  errorEl.textContent = '';
  try {
    await apiFetch('/api/doctor/consultations', {
      method: 'POST',
      body: JSON.stringify({
        patient_id: Number(patientId),
        reason: document.getElementById('reason').value,
        notes: document.getElementById('notes').value,
      }),
    });
    document.getElementById('consultationForm').reset();
    await loadDossier();
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

document.getElementById('diagnosticForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('subFormError');
  errorEl.textContent = '';
  const consultationId = document.getElementById('targetConsultation').value;
  if (!consultationId) {
    errorEl.textContent = 'Créez d\'abord une consultation.';
    return;
  }
  try {
    await apiFetch('/api/doctor/diagnostics', {
      method: 'POST',
      body: JSON.stringify({
        consultation_id: Number(consultationId),
        description: document.getElementById('diagnosticDescription').value,
      }),
    });
    document.getElementById('diagnosticForm').reset();
    await loadDossier();
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

document.getElementById('prescriptionForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('subFormError');
  errorEl.textContent = '';
  const consultationId = document.getElementById('targetConsultation').value;
  if (!consultationId) {
    errorEl.textContent = 'Créez d\'abord une consultation.';
    return;
  }
  try {
    await apiFetch('/api/doctor/prescriptions', {
      method: 'POST',
      body: JSON.stringify({
        consultation_id: Number(consultationId),
        medication: document.getElementById('medication').value,
        dosage: document.getElementById('dosage').value,
        duration: document.getElementById('duration').value,
        instructions: document.getElementById('instructions').value,
      }),
    });
    document.getElementById('prescriptionForm').reset();
    await loadDossier();
  } catch (err) {
    errorEl.textContent = err.message;
  }
});
