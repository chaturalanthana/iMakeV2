const express = require('express');
const controller = require('../controllers/controlController');

const work = express.Router();
work.get('/dashboard', controller.getDashboard);
work.get('/approvals/count', controller.getApprovalCount);
work.get('/approvals', controller.getApprovals);
work.post('/approvals/:id/decide', controller.decideApproval);
work.get('/audit', controller.getAudit);

const controls = express.Router();
controls.get('/approval-rules', controller.getApprovalRules);
controls.put('/approval-rules/:documentType', controller.updateApprovalRule);
controls.get('/periods', controller.getPeriods);
controls.put('/periods', controller.updatePeriod);
controls.put('/stock', controller.updateControls);
controls.get('/modules', controller.getModules);
controls.put('/modules', controller.updateModules);

module.exports = { work, controls };
