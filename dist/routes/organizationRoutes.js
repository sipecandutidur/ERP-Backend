"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const organizationController_1 = require("../controllers/organizationController");
const importController_1 = require("../controllers/importController");
const router = (0, express_1.Router)();
// Route definitions for Organizations
router.post('/import', importController_1.importOrganizations);
router.get('/', organizationController_1.getOrganizations);
router.get('/:id', organizationController_1.getOrganizationById);
router.post('/', organizationController_1.createOrganization);
router.put('/:id', organizationController_1.updateOrganization);
router.delete('/:id', organizationController_1.deleteOrganization);
exports.default = router;
