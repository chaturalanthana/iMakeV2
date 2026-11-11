const app = require('./app');
const { port } = require('./config');
const { migrateAllTenants } = require('./services/production/workOrders');
const { runDueReplenishment } = require('./services/replenishment');
const { closeDueWorkOrders } = require('./services/production/phase4');
const { ensureAllProductTypes } = require('./services/productTypes');

const startServer = () => {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    migrateAllTenants().catch((error) => {
      console.error('Work order migration skipped:', error.message);
    });
    ensureAllProductTypes().catch((error) => {
      console.error('Product type generation skipped:', error.message);
    });
    if (process.env.NODE_ENV !== 'test') {
      const tick = () => {
        runDueReplenishment().catch((error) => {
          console.error('Replenishment schedule skipped:', error.message);
        });
        closeDueWorkOrders().catch((error) => {
          console.error('Work order auto-close skipped:', error.message);
        });
      };
      setTimeout(tick, 15000);
      setInterval(tick, 60 * 60 * 1000);
    }
  });
};

startServer();
