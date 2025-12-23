require('dotenv').config();

const requiredEnvVars = [
  'DB_PASSWORD',
  'JWT_SECRET',
  'GEMINI_API_KEY'
];

const optionalEnvVars = [
  'DB_HOST',
  'DB_USER',
  'DB_NAME',
  'DB_PORT',
  'NODE_ENV',
  'PORT'
];

// Check required environment variables
requiredEnvVars.forEach(envVar => {
  if (!process.env[envVar]) {
    console.error(`❌ Required environment variable ${envVar} is missing`);
    process.exit(1);
  }
});

// Set defaults for optional variables
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.PORT = process.env.PORT || 5000;
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_USER = process.env.DB_USER || 'postgres';
process.env.DB_NAME = process.env.DB_NAME || 'auth_db';
process.env.DB_PORT = process.env.DB_PORT || 5432;

console.log(`✅ Environment variables validated for ${process.env.NODE_ENV} environment`);
