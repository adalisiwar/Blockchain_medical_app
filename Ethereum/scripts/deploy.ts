import { network } from "hardhat";

async function main() {
  const { ethers } = await network.create();
  console.log("--------------------------------------------------");
  console.log("🚀 Déploiement du smart contract MedicalRecord...");
  console.log("--------------------------------------------------");

  const [deployer] = await ethers.getSigners();
  console.log("👤 Compte de déploiement :", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Solde du compte :", ethers.formatEther(balance), "ETH");

  const medicalRecord = await ethers.deployContract("MedicalRecord");
  await medicalRecord.waitForDeployment();

  const contractAddress = await medicalRecord.getAddress();
  console.log("--------------------------------------------------");
  console.log("✅ Smart contract déployé avec succès !");
  console.log("📍 Adresse du contrat :", contractAddress);
  console.log("--------------------------------------------------");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
