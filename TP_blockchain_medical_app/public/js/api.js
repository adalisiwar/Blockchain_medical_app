// public/js/api.js
// Petit helper partage entre les espaces medecin et patient.

function getToken() {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/index.html';
  }
  return token;
}

function requireRole(expectedRole) {
  const role = localStorage.getItem('role');
  if (role !== expectedRole) {
    window.location.href = '/index.html';
  }
}

async function apiFetch(url, options = {}) {
  const token = getToken();
  const headers = Object.assign(
    { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    options.headers || {}
  );
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401 || res.status === 403) {
    logout();
    throw new Error('Session expiree.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Erreur serveur.');
  }
  return data;
}

function logout() {
  localStorage.clear();

  const authFields = [
    document.getElementById('loginEmail'),
    document.getElementById('loginPassword'),
    document.getElementById('registerName'),
    document.getElementById('registerEmail'),
    document.getElementById('registerPassword'),
    document.getElementById('registerSpecialty'),
    document.getElementById('registerBirthDate'),
    document.getElementById('registerDoctor')
  ];

  authFields.forEach((field) => {
    if (field) {
      field.value = '';
      field.setAttribute('autocomplete', 'off');
    }
  });

  const genderField = document.getElementById('registerGender');
  if (genderField) {
    genderField.value = 'Homme';
    genderField.setAttribute('autocomplete', 'off');
  }

  window.location.href = '/index.html';
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  return d.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
}
