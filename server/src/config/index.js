require('dotenv').config();

module.exports = {
  port: process.env.PORT || 5000,
  jwtSecret: process.env.JWT_SECRET || 'fallback_secret_keep_it_safe',
  databaseUrl: process.env.DATABASE_URL
};
