"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const accountingController_1 = require("../controllers/accountingController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authenticate);
// Financial summary (Dashboard)
router.get('/summary', accountingController_1.getFinancialSummary);
// Ledger & CashFlow
router.get('/transactions', accountingController_1.getTransactions);
router.post('/transactions', accountingController_1.createTransaction);
exports.default = router;
