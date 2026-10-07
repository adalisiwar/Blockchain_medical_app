import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.create();

describe("Smart Contract MedicalRecord - Tests Unitaires", function () {
  async function deployMedicalRecordFixture() {
    const [owner, doctor] = await ethers.getSigners();
    const medicalRecord = await ethers.deployContract("MedicalRecord");
    return { medicalRecord, owner, doctor };
  }

  const PATIENT_ID = 1n;
  const HASH_VERSION_1 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
  const HASH_VERSION_2 = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
  const HASH_ALTERE = "0000000000000000000000000000000000000000000000000000000000000000";

  describe("1. Enregistrement et Événement", function () {
    it("doit enregistrer un hash et emettre l'evenement RecordAdded", async function () {
      const { medicalRecord } = await networkHelpers.loadFixture(deployMedicalRecordFixture);

      await expect(medicalRecord.addRecord(PATIENT_ID, HASH_VERSION_1))
        .to.emit(medicalRecord, "RecordAdded")
        .withArgs(PATIENT_ID, HASH_VERSION_1, (val: any) => typeof val === "bigint", 1n);

      expect(await medicalRecord.getRecordCount(PATIENT_ID)).to.equal(1n);
    });

    it("doit rejeter l'enregistrement d'un hash vide", async function () {
      const { medicalRecord } = await networkHelpers.loadFixture(deployMedicalRecordFixture);

      await expect(medicalRecord.addRecord(PATIENT_ID, ""))
        .to.be.revertedWith("Le hash ne peut pas etre vide");
    });
  });

  describe("2. Recuperation du dernier hash", function () {
    it("doit recuperer correctement le dernier hash enregistre et son horodatage", async function () {
      const { medicalRecord } = await networkHelpers.loadFixture(deployMedicalRecordFixture);

      await medicalRecord.addRecord(PATIENT_ID, HASH_VERSION_1);
      const [lastHash, timestamp] = await medicalRecord.getLastRecord(PATIENT_ID);

      expect(lastHash).to.equal(HASH_VERSION_1);
      expect(timestamp).to.be.greaterThan(0n);
    });
  });

  describe("3. Verification de l'integrite (Hash correct vs altere)", function () {
    it("doit valider l'integrite pour un hash correct", async function () {
      const { medicalRecord } = await networkHelpers.loadFixture(deployMedicalRecordFixture);

      await medicalRecord.addRecord(PATIENT_ID, HASH_VERSION_1);
      const isIntact = await medicalRecord.verifyIntegrity(PATIENT_ID, HASH_VERSION_1);

      expect(isIntact).to.be.true;
    });

    it("doit detecter l'alteration pour un hash incorrect", async function () {
      const { medicalRecord } = await networkHelpers.loadFixture(deployMedicalRecordFixture);

      await medicalRecord.addRecord(PATIENT_ID, HASH_VERSION_1);
      const isIntact = await medicalRecord.verifyIntegrity(PATIENT_ID, HASH_ALTERE);

      expect(isIntact).to.be.false;
    });
  });

  describe("4. Comportement pour un patient sans dossier", function () {
    it("doit revert si on demande le dernier hash d'un patient sans dossier", async function () {
      const { medicalRecord } = await networkHelpers.loadFixture(deployMedicalRecordFixture);
      const UNKNOWN_PATIENT_ID = 999n;

      await expect(medicalRecord.getLastRecord(UNKNOWN_PATIENT_ID))
        .to.be.revertedWith("Aucun dossier pour ce patient");
    });

    it("doit revert si on verifie l'integrite pour un patient sans dossier", async function () {
      const { medicalRecord } = await networkHelpers.loadFixture(deployMedicalRecordFixture);
      const UNKNOWN_PATIENT_ID = 999n;

      await expect(medicalRecord.verifyIntegrity(UNKNOWN_PATIENT_ID, HASH_VERSION_1))
        .to.be.revertedWith("Aucun dossier pour ce patient");
    });

    it("doit retourner 0 pour le nombre de versions d'un patient sans dossier", async function () {
      const { medicalRecord } = await networkHelpers.loadFixture(deployMedicalRecordFixture);
      expect(await medicalRecord.getRecordCount(999n)).to.equal(0n);
    });
  });

  describe("5. Gestion de plusieurs versions", function () {
    it("doit historiser plusieurs versions et toujours retourner la derniere", async function () {
      const { medicalRecord } = await networkHelpers.loadFixture(deployMedicalRecordFixture);

      // Version 1
      await medicalRecord.addRecord(PATIENT_ID, HASH_VERSION_1);
      expect(await medicalRecord.getRecordCount(PATIENT_ID)).to.equal(1n);

      // Version 2
      await medicalRecord.addRecord(PATIENT_ID, HASH_VERSION_2);
      expect(await medicalRecord.getRecordCount(PATIENT_ID)).to.equal(2n);

      // Verification du dernier hash
      const [lastHash] = await medicalRecord.getLastRecord(PATIENT_ID);
      expect(lastHash).to.equal(HASH_VERSION_2);

      // Verification que l'ancien hash est detecte comme perime
      expect(await medicalRecord.verifyIntegrity(PATIENT_ID, HASH_VERSION_1)).to.be.false;
      expect(await medicalRecord.verifyIntegrity(PATIENT_ID, HASH_VERSION_2)).to.be.true;

      // Verification par index
      const [v1Hash] = await medicalRecord.getRecordByIndex(PATIENT_ID, 0n);
      const [v2Hash] = await medicalRecord.getRecordByIndex(PATIENT_ID, 1n);
      expect(v1Hash).to.equal(HASH_VERSION_1);
      expect(v2Hash).to.equal(HASH_VERSION_2);
    });
  });
});
