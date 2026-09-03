require('dotenv').config();
const { createHttpServer } = require('./src/httpServer');

const PORT = process.env.PORT || 5000;
const { httpServer } = createHttpServer();

httpServer.listen(PORT, () => {
  console.log(`🚀 SoftwareQuoter server running on http://localhost:${PORT}`);
});
