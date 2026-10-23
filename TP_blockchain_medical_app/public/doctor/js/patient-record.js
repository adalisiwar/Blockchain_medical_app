// Dossier Patient & Intégration Blockchain (Ethers.js v6)
const user = JSON.parse(localStorage.getItem('user') || 'null');

if (!user || user.role !== 'DOCTOR') {
  window.location.href = '/login.html';
}

// Récupérer le patientId depuis l'URL
const urlParams = new URLSearchParams(window.location.search);
const patientId = urlParams.get('patientId') || '1';

// Configuration Blockchain Ethereum
const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const CONTRACT_ABI = [
  "function addRecord(uint256 _patientId, string memory _recordHash) public",
  "function getLastRecord(uint256 _patientId) public view returns (string memory recordHash, uint256 timestamp)",
  "function getRecordCount(uint256 _patientId) public view returns (uint256)",
  "function verifyIntegrity(uint256 _patientId, string memory _hashToVerify) public view returns (bool)",
  "event RecordAdded(uint256 indexed patientId, string recordHash, uint256 timestamp)"
];

let provider = null;
let signer = null;
let medicalContract = null;
let currentLocalHash = "";
let currentPatientData = null;

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('doctorNameTag').textContent = `👨‍⚕️ ${user.name}`;
  document.getElementById('statusPatientLabel').textContent = `ID #${patientId}`;
  document.getElementById('consDate').value = new Date().toISOString().split('T')[0];

  // Charger le dossier médical local depuis l'API
  await loadPatientRecord();

  // Initialiser la connexion MetaMask si déjà autorisée
  if (window.ethereum) {
    provider = new ethers.BrowserProvider(window.ethereum);
    try {
      const accounts = await provider.listAccounts();
      if (accounts.length > 0) {
        await setupWallet();
      }
    } catch (e) {
      console.log("MetaMask pas encore connecté", e);
    }

    window.ethereum.on('accountsChanged', async (accounts) => {
      if (accounts && accounts.length > 0) {
        await setupWallet();
      } else {
        resetWalletUI();
      }
    });

    window.ethereum.on('chainChanged', async (chainIdHex) => {
      console.log("Réseau changé :", chainIdHex);
      await setupWallet();
    });
  } else {
    document.getElementById('bcAccount').innerHTML = '<span style="color:red;">MetaMask non détecté</span>';
  }
});

// 1. Charger les données du patient et calculer le Hash canonique
async function loadPatientRecord() {
  try {
    const res = await fetch(`/api/doctor/patient/${patientId}/record`, {
      headers: { 'user-id': user.id }
    });

    if (!res.ok) throw new Error('Impossible de charger le dossier du patient');

    const data = await res.json();
    currentPatientData = data;

    // Remplir les informations générales
    document.getElementById('patId').textContent = `#${data.patient.patient_id}`;
    document.getElementById('patName').textContent = data.patient.name;
    document.getElementById('patEmail').textContent = data.patient.email;
    document.getElementById('patBirth').textContent = data.patient.birth_date || 'Non renseigné';
    document.getElementById('patGender').textContent = data.patient.gender || 'Non renseigné';
    document.getElementById('patBlood').textContent = data.patient.blood_type || 'Non renseigné';

    // Remplir la table des consultations
    const tbody = document.getElementById('consultationsTableBody');
    tbody.innerHTML = '';

    if (data.consultations.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Aucune consultation enregistrée</td></tr>';
    } else {
      data.consultations.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>#${c.id}</strong></td>
          <td>${c.date}</td>
          <td>👨‍⚕️ ${escapeHtml(c.doctor_name || 'Dr. Médecin')}</td>
          <td><strong>${escapeHtml(c.diagnostic)}</strong></td>
          <td>${escapeHtml(c.prescription || 'N/A')}</td>
          <td><small>${escapeHtml(c.notes || '—')}</small></td>
        `;
        tbody.appendChild(tr);
      });
    }

    // Calcul du Hash Keccak256 de la structure canonique
    const canonicalString = JSON.stringify(data.canonical_record);
    if (window.ethers) {
      currentLocalHash = ethers.keccak256(ethers.toUtf8Bytes(canonicalString));
    } else {
      // Fallback simple si ethers n'est pas encore dispo
      currentLocalHash = "Calcul...";
    }

    document.getElementById('localRecordHash').textContent = currentLocalHash;

    // Si le contrat est connecté, rafraîchir l'affichage on-chain
    if (medicalContract) {
      await refreshBlockchainData();
    }
  } catch (err) {
    showAlert('pageAlert', 'alert-danger', '❌ ' + err.message);
  }
}

// 2. Connexion MetaMask & Configuration du Provider/Signer
async function connectWallet() {
  if (!window.ethereum) {
    alert("Veuillez installer l'extension MetaMask pour interagir avec la blockchain Ethereum !");
    return;
  }

  try {
    provider = new ethers.BrowserProvider(window.ethereum);
    await window.ethereum.request({ method: 'eth_requestAccounts' });

    // Vérifier le réseau (Hardhat = chainId 31337 / 0x7A69)
    const network = await provider.getNetwork();
    const chainIdHex = "0x" + Number(network.chainId).toString(16);

    if (network.chainId !== 31337n && network.chainId !== 1337n) {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x7a69' }], // 31337 en hex
        });
      } catch (switchError) {
        // Si le réseau n'existe pas dans MetaMask, l'ajouter
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

    await setupWallet();
  } catch (err) {
    showAlert('pageAlert', 'alert-danger', "Connexion annulée ou erreur : " + err.message);
  }
}

async function setupWallet() {
  try {
    if (!window.ethereum) return;
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    const address = await signer.getAddress();
    const network = await provider.getNetwork();

    document.getElementById('bcAccount').textContent = `${address.substring(0, 6)}...${address.substring(38)}`;
    document.getElementById('bcNetwork').textContent = `${network.name} (ChainID: ${network.chainId})`;
    document.getElementById('btnConnectMetamask').innerHTML = '🦊 Connecté';
    document.getElementById('btnConnectMetamask').classList.replace('btn-metamask', 'btn-success');

    medicalContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    if (network.chainId === 31337n || network.chainId === 1337n) {
      await refreshBlockchainData();
    }
  } catch (err) {
    console.error("Erreur setupWallet:", err);
  }
}

function resetWalletUI() {
  signer = null;
  medicalContract = null;
  document.getElementById('bcAccount').textContent = 'Non connecté';
  document.getElementById('bcNetwork').textContent = 'Inconnu';
  document.getElementById('btnConnectMetamask').innerHTML = '🦊 Connecter MetaMask';
  document.getElementById('btnConnectMetamask').classList.replace('btn-success', 'btn-metamask');
}

// 3. Récupérer les données du Smart Contract (On-Chain)
async function refreshBlockchainData() {
  if (!medicalContract) {
    showAlert('pageAlert', 'alert-warning', '⚠️ Veuillez connecter MetaMask pour interroger la blockchain.');
    return;
  }

  try {
    const countBigInt = await medicalContract.getRecordCount(BigInt(patientId));
    const count = Number(countBigInt);
    document.getElementById('onChainCount').textContent = `${count} version(s)`;

    if (count > 0) {
      const [lastHash, timestampBigInt] = await medicalContract.getLastRecord(BigInt(patientId));
      const date = new Date(Number(timestampBigInt) * 1000);

      document.getElementById('onChainHash').textContent = lastHash;
      document.getElementById('onChainTimestamp').textContent = date.toLocaleString('fr-FR');
    } else {
      document.getElementById('onChainHash').textContent = "Aucun hash enregistré sur la blockchain";
      document.getElementById('onChainTimestamp').textContent = "Dossier non encore ancré";
    }
  } catch (err) {
    console.error("Erreur lecture blockchain:", err);
    document.getElementById('onChainHash').textContent = "Erreur lecture ou contrat non déployé à cette adresse";
  }
}

// 4. Action : Enregistrer le dossier sur la blockchain
async function saveRecordToBlockchain() {
  if (!medicalContract || !signer) {
    alert("Veuillez d'abord connecter votre portefeuille MetaMask !");
    await connectWallet();
    if (!medicalContract) return;
  }

  const txLog = document.getElementById('txLog');
  txLog.style.display = 'block';
  txLog.className = 'alert alert-info';
  txLog.innerHTML = '⏳ <strong>Transaction en cours...</strong> Veuillez confirmer la transaction dans votre extension MetaMask.';

  try {
    // Calculer le hash frais
    const canonicalString = JSON.stringify(currentPatientData.canonical_record);
    currentLocalHash = ethers.keccak256(ethers.toUtf8Bytes(canonicalString));

    // Envoyer la transaction au Smart Contract
    const tx = await medicalContract.addRecord(BigInt(patientId), currentLocalHash);

    txLog.innerHTML = `📡 <strong>Transaction diffusée :</strong> <span style="font-family: monospace; font-size: 12px;">${tx.hash}</span><br>En attente de minage sur le bloc Ethereum...`;

    // Attendre la confirmation du bloc
    const receipt = await tx.wait();

    txLog.className = 'alert alert-success';
    txLog.innerHTML = `✅ <strong>Dossier médical enregistré avec succès sur la blockchain !</strong><br>Bloc miné : <strong>#${receipt.blockNumber}</strong> | Tx: <span style="font-family: monospace; font-size: 12px;">${receipt.hash}</span>`;

    // Actualiser le statut
    await refreshBlockchainData();

    // Vérifier l'intégrité automatiquement
    await verifyRecordIntegrity();
  } catch (err) {
    console.error(err);
    txLog.className = 'alert alert-danger';
    txLog.innerHTML = `❌ <strong>Échec de la transaction :</strong> ${err.reason || err.message}`;
  }
}

// 5. Action : Vérifier l'intégrité du dossier médical
async function verifyRecordIntegrity() {
  const resultBox = document.getElementById('integrityResultBox');
  resultBox.style.display = 'block';

  if (!medicalContract) {
    resultBox.className = 'alert alert-warning';
    resultBox.innerHTML = '⚠️ Veuillez connecter MetaMask pour vérifier l\'intégrité sur la blockchain.';
    return;
  }

  try {
    // Calculer le hash local exact
    const canonicalString = JSON.stringify(currentPatientData.canonical_record);
    currentLocalHash = ethers.keccak256(ethers.toUtf8Bytes(canonicalString));
    document.getElementById('localRecordHash').textContent = currentLocalHash;

    const countBigInt = await medicalContract.getRecordCount(BigInt(patientId));
    if (Number(countBigInt) === 0) {
      resultBox.className = 'alert alert-info';
      resultBox.innerHTML = `ℹ️ <strong>Aucun dossier trouvé :</strong> Aucun enregistrement blockchain n'a encore été créé pour ce patient. Cliquez sur « Enregistrer le dossier sur la blockchain » pour créer la première version d'intégrité.`;
      return;
    }

    // Appeler la fonction view verifyIntegrity du smart contract
    const isIntact = await medicalContract.verifyIntegrity(BigInt(patientId), currentLocalHash);

    if (isIntact) {
      resultBox.className = 'alert alert-success';
      resultBox.innerHTML = `
        <div style="font-size: 15px;">
          ✅ <strong>Intégrité vérifiée :</strong> Le dossier médical local correspond exactement à la version immuable enregistrée sur la blockchain Ethereum.
        </div>
        <div style="font-size: 12px; margin-top: 4px; color: #166534;">
          Hash vérifié : <code>${currentLocalHash}</code>
        </div>
      `;
    } else {
      const [lastHash] = await medicalContract.getLastRecord(BigInt(patientId));
      resultBox.className = 'alert alert-danger';
      resultBox.innerHTML = `
        <div style="font-size: 15px;">
          ⚠️ <strong>Intégrité compromise :</strong> Le dossier médical a été altéré ou modifié localement par rapport à la version immuable de la blockchain !
        </div>
        <div style="font-size: 12px; margin-top: 6px;">
          <strong>Hash On-Chain (Blockchain) :</strong> <code>${lastHash}</code><br>
          <strong>Hash Local Actuel :</strong> <code>${currentLocalHash}</code>
        </div>
      `;
    }
  } catch (err) {
    console.error(err);
    resultBox.className = 'alert alert-danger';
    resultBox.innerHTML = `❌ <strong>Erreur :</strong> ${err.message}`;
  }
}

// 6. Gestion du Modal d'Ajout de Consultation
function openConsultationModal() {
  document.getElementById('consultationModal').classList.remove('hidden');
}

function closeConsultationModal() {
  document.getElementById('consultationModal').classList.add('hidden');
}

document.getElementById('consultationForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const date = document.getElementById('consDate').value;
  const diagnostic = document.getElementById('consDiag').value.trim();
  const prescription = document.getElementById('consPresc').value.trim();
  const notes = document.getElementById('consNotes').value.trim();

  try {
    const res = await fetch(`/api/doctor/patient/${patientId}/consultation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'user-id': user.id
      },
      body: JSON.stringify({ date, diagnostic, prescription, notes })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de l\'ajout de la consultation');

    closeConsultationModal();
    document.getElementById('consultationForm').reset();
    document.getElementById('consDate').value = new Date().toISOString().split('T')[0];

    showAlert('pageAlert', 'alert-success', '✅ Consultation ajoutée au dossier avec succès ! Le hash local a été actualisé.');

    // Recharger le dossier médical et recalculer le hash
    await loadPatientRecord();
  } catch (err) {
    alert("Erreur : " + err.message);
  }
});

function showAlert(elementId, typeClass, message) {
  const el = document.getElementById(elementId);
  el.className = `alert ${typeClass}`;
  el.innerHTML = message;
  el.style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function logout() {
  localStorage.removeItem('user');
  window.location.href = '/login.html';
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
