require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

function requiredEnv(name) {
  const value = process.env[name];
  if (typeof value === 'string' && value.trim()) return value.trim();
  throw new Error(
    `${name} is required. Set it in the environment (see .env.example). ` +
    'The previous hardcoded value was removed because this repository was public and must be rotated.'
  );
}

// Fail on startup in every environment, including production, when a secret is missing.
const jwtSecret = requiredEnv('JWT_SECRET');
const databaseUrl = requiredEnv('DATABASE_URL');

module.exports = {
  port: process.env.PORT || 5000,
  jwtSecret,
  databaseUrl,
  isProduction,
  nodeEnv: process.env.NODE_ENV || 'development'
};
