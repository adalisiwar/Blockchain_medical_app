// public/doctor/js/dashboard.js
requireRole('medecin');
document.getElementById('doctorName').textContent = 'Dr ' + (localStorage.getItem('name') || '');

async function loadPatients() {
  try {
    const patients = await apiFetch('/api/doctor/patients');
    const tbody = document.getElementById('patientsBody');
    const emptyState = document.getElementById('emptyState');
    tbody.innerHTML = '';

    if (patients.length === 0) {
      emptyState.classList.remove('hidden');
      return;
    }
    emptyState.classList.add('hidden');

    patients.forEach((p) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.name}</td>
        <td>${p.email}</td>
        <td>${p.birth_date || '-'}</td>
        <td>${p.gender || '-'}</td>
        <td><button class="link-btn" onclick="openPatient(${p.patient_id})">Voir le dossier →</button></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    alert(err.message);
  }
}

function openPatient(patientId) {
  window.location.href = `patient.html?id=${patientId}`;
}

loadPatients();
