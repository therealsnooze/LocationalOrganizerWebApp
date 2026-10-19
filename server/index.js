const app = require('./app');
const { PORT } = require('./config');

app.listen(PORT, () => {
  console.log(`Locational Organizer running at http://localhost:${PORT}`);
});
