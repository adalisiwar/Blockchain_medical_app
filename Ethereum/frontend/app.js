// Adresse du Smart Contract déployé en local
const CONTRACT_ADDRESS = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
const LOCAL_CHAIN_ID_HEX = "0x7A69"; // 31337 en hexadécimal

// ABI du contrat MedicalRecord
const CONTRACT_ABI = [
    "event RecordAdded(uint256 indexed patientId, string recordHash, uint256 timestamp, uint256 versionNumber)",
    "function addRecord(uint256 _patientId, string memory _recordHash) public",
    "function getLastRecord(uint256 _patientId) public view returns (string memory recordHash, uint256 timestamp)",
    "function getRecordByIndex(uint256 _patientId, uint256 _versionIndex) public view returns (string memory recordHash, uint256 timestamp)",
    "function getRecordCount(uint256 _patientId) public view returns (uint256)",
    "function verifyIntegrity(uint256 _patientId, string memory _hashToVerify) public view returns (bool)"
];

let provider = null;
let signer = null;
let contract = null;
let userAddress = null;

// Éléments du DOM
const connectBtn = document.getElementById("connectBtn");
const accountAddressEl = document.getElementById("accountAddress");
const networkNameEl = document.getElementById("networkName");
const accountBalanceEl = document.getElementById("accountBalance");
const contractStatusEl = document.getElementById("contractStatus");

const addRecordForm = document.getElementById("addRecordForm");
const addPatientId = document.getElementById("addPatientId");
const addRecordHash = document.getElementById("addRecordHash");
const generateHashBtn = document.getElementById("generateHashBtn");
const submitRecordBtn = document.getElementById("submitRecordBtn");
const txStatus = document.getElementById("txStatus");

const getRecordForm = document.getElementById("getRecordForm");
const getPatientId = document.getElementById("getPatientId");
const readResult = document.getElementById("readResult");
const resHash = document.getElementById("resHash");
const resTimestamp = document.getElementById("resTimestamp");
const resCount = document.getElementById("resCount");

const verifyForm = document.getElementById("verifyForm");
const verifyPatientId = document.getElementById("verifyPatientId");
const verifyHash = document.getElementById("verifyHash");
const integrityResult = document.getElementById("integrityResult");

function getEthereumProvider() {
    if (typeof window.ethereum !== "undefined") {
        if (window.ethereum.providers?.length) {
            return window.ethereum.providers.find(p => p.isMetaMask) || window.ethereum.providers[0];
        }
        return window.ethereum;
    }
    return null;
}

// Fonction pour forcer MetaMask sur le réseau Hardhat Localhost (31337)
async function ensureLocalhostNetwork(ethProvider) {
    try {
        await ethProvider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: LOCAL_CHAIN_ID_HEX }]
        });
    } catch (switchError) {
        if (switchError.code === 4902 || switchError.code === -32603) {
            try {
                await ethProvider.request({
                    method: "wallet_addEthereumChain",
                    params: [{
                        chainId: LOCAL_CHAIN_ID_HEX,
                        chainName: "Hardhat Localhost",
                        rpcUrls: ["http://127.0.0.1:8545"],
                        nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }
                    }]
                });
            } catch (addError) {
                console.error("Erreur ajout réseau :", addError);
            }
        }
    }
}

// 1. CONNEXION MANUELLE À METAMASK
async function connectWallet() {
    const ethProvider = getEthereumProvider();

    if (!ethProvider) {
        alert("MetaMask n'est pas détecté dans cette fenêtre de navigateur !");
        return;
    }

    try {
        connectBtn.innerText = "⏳ Connexion...";
        
        // 1. Forcer le passage sur le réseau Hardhat Localhost
        await ensureLocalhostNetwork(ethProvider);

        // 2. Demande de connexion
        provider = new ethers.BrowserProvider(ethProvider);
        const accounts = await ethProvider.request({ method: "eth_requestAccounts" });
        if (!accounts || accounts.length === 0) {
            connectBtn.innerText = "🦊 Connecter MetaMask";
            return;
        }

        signer = await provider.getSigner();
        userAddress = accounts[0];

        const network = await provider.getNetwork();
        const balance = await provider.getBalance(userAddress);

        contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

        accountAddressEl.innerText = `${userAddress.substring(0, 6)}...${userAddress.substring(userAddress.length - 4)}`;
        accountAddressEl.title = userAddress;
        networkNameEl.innerText = `Hardhat Localhost (ID: ${network.chainId})`;
        accountBalanceEl.innerText = `${parseFloat(ethers.formatEther(balance)).toFixed(4)} ETH`;
        contractStatusEl.innerText = CONTRACT_ADDRESS;

        connectBtn.innerText = "🦊 Connecté";
        connectBtn.classList.replace("btn-primary", "btn-secondary");

        console.log("Connecté avec succès :", userAddress, "sur réseau :", network.chainId);
    } catch (err) {
        console.error("Erreur de connexion :", err);
        alert("Erreur de connexion : " + (err.message || err));
        connectBtn.innerText = "🦊 Connecter MetaMask";
    }
}

connectBtn.addEventListener("click", connectWallet);

// 2. GÉNÉRATION D'UN HASH TEST
generateHashBtn.addEventListener("click", () => {
    const randomData = "Dossier médical patient - " + Date.now() + " - Dr Mansouri";
    const hash = ethers.keccak256(ethers.toUtf8Bytes(randomData));
    addRecordHash.value = hash;
    verifyHash.value = hash;
});

// 3. ENREGISTRER UNE EMPREINTE (TRANSACTION)
addRecordForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const ethProvider = getEthereumProvider();
    if (!ethProvider) return;

    try {
        // S'assurer qu'on est bien sur Localhost avant d'envoyer la transaction
        await ensureLocalhostNetwork(ethProvider);
        if (!signer || !contract) {
            await connectWallet();
        }

        const patientId = addPatientId.value;
        const hashValue = addRecordHash.value.trim();

        txStatus.classList.remove("hidden");
        txStatus.innerHTML = "⏳ Confirmez la transaction dans la popup MetaMask...";
        submitRecordBtn.disabled = true;

        const tx = await contract.addRecord(patientId, hashValue);
        txStatus.innerHTML = `📡 Transaction soumise ! Hash : <code>${tx.hash}</code><br>⏳ Validation sur le bloc local...`;

        const receipt = await tx.wait();
        txStatus.innerHTML = `✅ <strong>Succès !</strong> Empreinte enregistrée dans le bloc #${receipt.blockNumber} !<br>⛽ Gas utilisé : ${receipt.gasUsed.toString()}`;
        
        const balance = await provider.getBalance(userAddress);
        accountBalanceEl.innerText = `${parseFloat(ethers.formatEther(balance)).toFixed(4)} ETH`;

        submitRecordBtn.disabled = false;
    } catch (err) {
        console.error("Erreur transaction :", err);
        txStatus.classList.remove("hidden");
        txStatus.innerHTML = `❌ <strong>Erreur :</strong> ${err.message || err}`;
        submitRecordBtn.disabled = false;
    }
});

// 4. CONSULTER LE DERNIER HASH
getRecordForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!contract) {
        alert("Veuillez d'abord cliquer sur 'Connecter MetaMask' en haut !");
        return;
    }

    const patientId = getPatientId.value;

    try {
        readResult.classList.remove("hidden");
        resHash.innerText = "Chargement...";
        resTimestamp.innerText = "...";
        resCount.innerText = "...";

        const count = await contract.getRecordCount(patientId);
        if (count === 0n || count === 0) {
            resHash.innerText = "Aucun dossier trouvé pour ce patient.";
            resTimestamp.innerText = "N/A";
            resCount.innerText = "0 version";
            return;
        }

        const [lastHash, timestamp] = await contract.getLastRecord(patientId);
        const dateFormatted = new Date(Number(timestamp) * 1000).toLocaleString();

        resHash.innerText = lastHash;
        resTimestamp.innerText = dateFormatted;
        resCount.innerText = `${count.toString()} version(s)`;
    } catch (err) {
        console.error("Erreur lecture :", err);
        readResult.classList.remove("hidden");
        resHash.innerText = "Erreur de lecture.";
        resTimestamp.innerText = "N/A";
        resCount.innerText = "0";
    }
});

// 5. VÉRIFIER L'INTÉGRITÉ
verifyForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!contract) {
        alert("Veuillez d'abord cliquer sur 'Connecter MetaMask' en haut !");
        return;
    }

    const patientId = verifyPatientId.value;
    const hashToTest = verifyHash.value.trim();

    try {
        integrityResult.classList.remove("hidden");
        integrityResult.className = "alert-box";
        integrityResult.innerText = "⏳ Vérification sur la blockchain...";

        const count = await contract.getRecordCount(patientId);
        if (count === 0n || count === 0) {
            integrityResult.classList.add("alert-danger");
            integrityResult.innerHTML = `⚠️ <strong>AUCUN DOSSIER :</strong> Aucun dossier n'a encore été enregistré sur la blockchain pour le Patient #${patientId}.<br>👉 Veuillez d'abord enregistrer une empreinte via le formulaire <strong>1. Enregistrer une Empreinte</strong> ci-dessus !`;
            return;
        }

        const isIntact = await contract.verifyIntegrity(patientId, hashToTest);

        if (isIntact) {
            integrityResult.classList.add("alert-success");
            integrityResult.innerHTML = `✅ <strong>DOSSIER INTÈGRE :</strong> L'empreinte correspond exactement au dernier hash enregistré sur la blockchain pour le Patient #${patientId}.`;
        } else {
            integrityResult.classList.add("alert-danger");
            integrityResult.innerHTML = `⚠️ <strong>DOSSIER ALTÉRÉ OU OBSOLÈTE :</strong> L'empreinte ne correspond pas au hash de référence ! Le dossier a été modifié ou falsifié.`;
        }
    } catch (err) {
        console.error("Erreur vérification :", err);
        integrityResult.classList.add("alert-danger");
        integrityResult.innerHTML = `❌ <strong>Erreur :</strong> ${err.reason || err.message || err}`;
    }
});
