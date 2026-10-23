// middleware/auth.js
const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentification requise.' });
  }
  const token = header.split(' ')[1];
  try {
    const secret = process.env.JWT_SECRET || 'super_secret_jwt_key_tp_medical_blockchain';
    const decoded = jwt.verify(token, secret);
    req.user = decoded; // { id, role, name, profileId }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token invalide ou expire.' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: 'Acces refuse pour ce role.' });
    }
    next();
  };
}

module.exports = { verifyToken, requireRole };
