const nodemailer = require('nodemailer');

/** Envoi d'e-mails. Sans SMTP configuré, les messages sont affichés dans la console. */
function createMailer(config) {
  const sent = [];
  const transport = config.mail.host
    ? nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.secure,
      auth: config.mail.user ? { user: config.mail.user, pass: config.mail.pass } : undefined,
    })
    : null;

  async function send({ to, subject, text }) {
    const message = { from: config.mail.from, to, subject, text };
    if (transport) return transport.sendMail(message);
    sent.push(message);
    if (process.env.NODE_ENV !== 'test') {
      console.log(`\n[e-mail non envoyé : SMTP non configuré]\nÀ : ${to}\nObjet : ${subject}\n\n${text}\n`);
    }
    return message;
  }

  return { send, sent };
}

module.exports = { createMailer };
