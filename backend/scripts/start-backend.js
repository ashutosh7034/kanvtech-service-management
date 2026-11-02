process.env.DATABASE_URL = 'postgresql://postgres:password@localhost:5433/kanvtech_sm_dev?schema=public';
process.env.PORT = '5000';
require('../dist/main.js');
