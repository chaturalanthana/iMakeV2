const app = require('./app');
const { port } = require('./config');
const { migrateAllTenants } = require('./services/production/workOrders');

const startServer = () => {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    migrateAllTenants().catch((error) => {
      console.error('Work order migration skipped:', error.message);
    });
  });
};

startServer();
