process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-jwt-secret-not-for-production';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://imake_user:imake_test@127.0.0.1:5432/imake_test';
