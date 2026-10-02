const env = process.env;

const isProd = env.NODE_ENV === 'production';

if (isProd && !env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET doit être défini en production.');
}

module.exports = {
  isProd,
  // Cookies « Secure » et passage forcé en HTTPS : activés en production, sauf COOKIE_SECURE=false
  // (utile pour tester sur http://IP:port avant d'avoir un domaine en HTTPS).
  cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : isProd,
  port: Number(env.PORT || 3000),
  sessionSecret: env.SESSION_SECRET || 'dev-secret-a-changer',
  baseUrl: env.BASE_URL || '',
  platformName: env.PLATFORM_NAME || 'Assos Troyes',
  city: env.PLATFORM_CITY || 'Troyes',
  requireValidation: (env.ASSOCIATIONS_REQUIRE_VALIDATION || 'true') !== 'false',
  mail: {
    host: env.SMTP_HOST || '',
    port: Number(env.SMTP_PORT || 587),
    secure: env.SMTP_SECURE === 'true',
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    from: env.MAIL_FROM || 'Assos Troyes <noreply@assos-troyes.fr>',
  },
};
