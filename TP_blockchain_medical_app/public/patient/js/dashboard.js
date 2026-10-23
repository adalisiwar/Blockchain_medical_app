// public/patient/js/dashboard.js
requireRole('patient');
document.getElementById('patientNameTop').textContent = localStorage.getItem('name') || '';

async function loadProfile() {
  try {
    const profile = await apiFetch('/api/patient/profile');
    document.getElementById('profileDetails').textContent =
      `${profile.name} · ${profile.email} · Né(e) le ${profile.birth_date || 'N/A'} · ${profile.gender || ''}`;
  } catch (err) {
    console.error(err);
  }
}

async function loadDossier() {
  try {
    const dossier = await apiFetch('/api/patient/dossier');
    const container = document.getElementById('dossierContainer');
    container.innerHTML = '';

    if (dossier.consultations.length === 0) {
      container.innerHTML = '<div class="empty-state">Aucune consultation pour le moment.</div>';
      return;
    }

    dossier.consultations.forEach((c) => {
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
          <span class="badge">Dr ${c.doctor_name}</span>
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
  } catch (err) {
    console.error(err);
  }
}

loadProfile();
loadDossier();
