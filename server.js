const { createServer } = require('./src/server/app');
const { PORT, DATA_DIR } = require('./src/server/config');

const server = createServer();

server.listen(PORT, () => {
  console.log(`Boke server running`);
  console.log(`Frontend: http://localhost:${PORT}`);
  console.log(`Admin:    http://localhost:${PORT}/admin.html`);
  console.log(`Data:     ${DATA_DIR}`);
});
