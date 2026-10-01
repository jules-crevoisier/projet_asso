/** Petits utilitaires de validation de formulaires. */

const str = (v, max = 5000) => String(v ?? '').trim().slice(0, max);
const int = (v, def = 0) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : def;
};
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const isUrl = (v) => {
  try { return ['http:', 'https:'].includes(new URL(v).protocol); } catch { return false; }
};

class FormErrors {
  constructor() { this.fields = {}; }
  add(field, message) { if (!this.fields[field]) this.fields[field] = message; return this; }
  require(field, value, message = 'Ce champ est obligatoire.') { if (!value) this.add(field, message); return this; }
  get any() { return Object.keys(this.fields).length > 0; }
}

module.exports = { str, int, isEmail, isUrl, FormErrors };
