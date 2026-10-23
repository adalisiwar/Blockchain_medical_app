// public/js/auth.js

// Si deja connecte, rediriger directement
(function redirectIfLoggedIn() {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');
  if (token && role) {
    window.location.href = role === 'medecin' ? 'doctor/dashboard.html' : 'patient/dashboard.html';
  }
})();

const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

function clearAuthForms() {
  if (loginForm) loginForm.reset();
  if (registerForm) registerForm.reset();

  const fieldIds = [
    'loginEmail', 'loginPassword',
    'registerName', 'registerEmail', 'registerPassword',
    'registerSpecialty', 'registerBirthDate', 'registerDoctor'
  ];

  fieldIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.value = '';
      el.setAttribute('autocomplete', 'off');
    }
  });

  const gender = document.getElementById('registerGender');
  if (gender) {
    gender.value = 'Homme';
    gender.setAttribute('autocomplete', 'off');
  }

  const loginError = document.getElementById('loginError');
  const registerError = document.getElementById('registerError');
  if (loginError) loginError.textContent = '';
  if (registerError) registerError.textContent = '';
}

tabLogin.addEventListener('click', () => {
  tabLogin.classList.add('active');
  tabRegister.classList.remove('active');
  loginForm.classList.remove('hidden');
  registerForm.classList.add('hidden');
  clearAuthForms();
});

tabRegister.addEventListener('click', () => {
  tabRegister.classList.add('active');
  tabLogin.classList.remove('active');
  registerForm.classList.remove('hidden');
  loginForm.classList.add('hidden');
  clearAuthForms();
});

window.addEventListener('DOMContentLoaded', () => {
  clearAuthForms();
  setTimeout(clearAuthForms, 100);
});

window.addEventListener('pageshow', (event) => {
  if (event.persisted || document.visibilityState === 'visible') {
    clearAuthForms();
  }
});

const registerRole = document.getElementById('registerRole');
const doctorFields = document.getElementById('doctorFields');
const patientFields = document.getElementById('patientFields');
const registerDoctor = document.getElementById('registerDoctor');
const registerBirthDate = document.getElementById('registerBirthDate');

// Empêche la sélection d'une date de naissance ultérieure à aujourd'hui.
if (registerBirthDate) {
  const today = new Date();
  const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60_000)
    .toISOString()
    .split('T')[0];
  registerBirthDate.max = localToday;
}

async function loadDoctorsForSelection() {
  try {
    const doctors = await fetch('/api/auth/doctors').then((res) => res.json());
    registerDoctor.innerHTML = '<option value="">Choisir un médecin</option>';

    if (!doctors.length) {
      registerDoctor.innerHTML = '<option value="">Aucun médecin disponible</option>';
      return;
    }

    doctors.forEach((doctor) => {
      const option = document.createElement('option');
      option.value = doctor.doctor_id;
      option.textContent = `${doctor.name}${doctor.specialty ? ' - ' + doctor.specialty : ''}`;
      registerDoctor.appendChild(option);
    });
  } catch (err) {
    registerDoctor.innerHTML = '<option value="">Impossible de charger les médecins</option>';
  }
}

function updateRegisterFields() {
  const isDoctor = registerRole.value === 'medecin';
  doctorFields.classList.toggle('hidden', !isDoctor);
  patientFields.classList.toggle('hidden', isDoctor);

  if (!isDoctor) {
    loadDoctorsForSelection();
  }
}

registerRole.addEventListener('change', updateRegisterFields);
updateRegisterFields();

function saveSessionAndRedirect(data) {
  localStorage.setItem('token', data.token);
  localStorage.setItem('role', data.user.role);
  localStorage.setItem('name', data.user.name);
  localStorage.setItem('profileId', data.user.profileId);
  window.location.href = data.user.role === 'medecin' ? 'doctor/dashboard.html' : 'patient/dashboard.html';
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');
  errorEl.textContent = '';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      errorEl.textContent = data.error || 'Erreur de connexion.';
      return;
    }
    saveSessionAndRedirect(data);
  } catch (err) {
    errorEl.textContent = 'Impossible de contacter le serveur.';
  }
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('registerError');
  errorEl.textContent = '';

  const role = registerRole.value;
  const payload = {
    role,
    name: document.getElementById('registerName').value.trim(),
    email: document.getElementById('registerEmail').value.trim(),
    password: document.getElementById('registerPassword').value,
  };

  if (role === 'medecin') {
    payload.specialty = document.getElementById('registerSpecialty').value.trim();
  } else {
    const selectedDoctorId = Number(registerDoctor.value);
    if (!selectedDoctorId) {
      errorEl.textContent = 'Veuillez choisir un médecin avant de créer le compte.';
      return;
    }

    payload.assigned_doctor_id = selectedDoctorId;
    payload.birth_date = registerBirthDate.value;
    payload.gender = document.getElementById('registerGender').value;
  }

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      errorEl.textContent = data.error || 'Erreur lors de la creation du compte.';
      return;
    }
    saveSessionAndRedirect(data);
  } catch (err) {
    errorEl.textContent = 'Impossible de contacter le serveur.';
  }
});
