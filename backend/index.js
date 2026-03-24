require('dotenv').config();
const createApp = require('./app');

const PORT = process.env.PORT || 3000;
const app = createApp();

app.listen(PORT, () => {
  console.log(`WIZZ API running at http://localhost:${PORT}`);
});
