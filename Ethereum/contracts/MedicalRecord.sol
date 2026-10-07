// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

/**
 * @title MedicalRecord
 * @dev Smart contract pour l'enregistrement et la vérification d'intégrité des dossiers médicaux
 */
contract MedicalRecord {
    // Structure représentant une version d'un dossier médical
    struct Record {
        string recordHash;    // Empreinte cryptographique (hash SHA-256)
        uint256 timestamp;    // Horodatage de l'enregistrement (block.timestamp)
    }

    // Mapping associant chaque ID patient à son historique de versions de dossier
    mapping(uint256 => Record[]) private patientRecords;

    // Événement émis lors de l'enregistrement d'une nouvelle empreinte
    event RecordAdded(
        uint256 indexed patientId,
        string recordHash,
        uint256 timestamp,
        uint256 versionNumber
    );

    /**
     * @notice Enregistre une nouvelle empreinte pour un patient
     * @param _patientId Identifiant unique du patient
     * @param _recordHash Empreinte cryptographique du dossier médical
     */
    function addRecord(uint256 _patientId, string memory _recordHash) public {
        require(bytes(_recordHash).length > 0, "Le hash ne peut pas etre vide");

        Record memory newRecord = Record({
            recordHash: _recordHash,
            timestamp: block.timestamp
        });

        patientRecords[_patientId].push(newRecord);
        uint256 versionNumber = patientRecords[_patientId].length;

        emit RecordAdded(_patientId, _recordHash, block.timestamp, versionNumber);
    }

    /**
     * @notice Récupère le dernier hash et son horodatage pour un patient donné
     * @param _patientId Identifiant du patient
     * @return recordHash Dernière empreinte enregistrée
     * @return timestamp Horodatage de cet enregistrement
     */
    function getLastRecord(uint256 _patientId) public view returns (string memory recordHash, uint256 timestamp) {
        require(patientRecords[_patientId].length > 0, "Aucun dossier pour ce patient");
        
        Record memory last = patientRecords[_patientId][patientRecords[_patientId].length - 1];
        return (last.recordHash, last.timestamp);
    }

    /**
     * @notice Vérifie si le hash fourni correspond au dernier hash enregistré sur la blockchain
     * @param _patientId Identifiant du patient
     * @param _hashToVerify Hash recalculé du dossier médical actuel
     * @return bool Vrai si le hash correspond (dossier intègre), faux s'il est altéré
     */
    function verifyIntegrity(uint256 _patientId, string memory _hashToVerify) public view returns (bool) {
        require(patientRecords[_patientId].length > 0, "Aucun dossier pour ce patient");
        
        Record memory last = patientRecords[_patientId][patientRecords[_patientId].length - 1];
        return keccak256(bytes(last.recordHash)) == keccak256(bytes(_hashToVerify));
    }

    /**
     * @notice Retourne le nombre total de versions enregistrées pour un patient
     * @param _patientId Identifiant du patient
     * @return uint256 Nombre de versions
     */
    function getRecordCount(uint256 _patientId) public view returns (uint256) {
        return patientRecords[_patientId].length;
    }

    /**
     * @notice Récupère une version spécifique d'un dossier
     * @param _patientId Identifiant du patient
     * @param _versionIndex Index de la version (0-indexed)
     */
    function getRecordByIndex(uint256 _patientId, uint256 _versionIndex) public view returns (string memory recordHash, uint256 timestamp) {
        require(_versionIndex < patientRecords[_patientId].length, "Index de version invalide");
        Record memory r = patientRecords[_patientId][_versionIndex];
        return (r.recordHash, r.timestamp);
    }
}
