// Vercel serverless entry point. vercel.json rewrites every /api/* request here,
// and the Express app routes it as usual.
module.exports = require('../server/app');
