"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("../prisma"));
const authenticate = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ status: 'error', message: 'Unauthorized' });
            return;
        }
        const token = authHeader.split(' ')[1];
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'fallback_secret');
        const user = yield prisma_1.default.user.findUnique({
            where: { id: decoded.userId },
            include: { role: true },
        });
        if (!user) {
            res.status(401).json({ status: 'error', message: 'User not found' });
            return;
        }
        req.user = {
            id: user.id,
            roleId: user.roleId,
            roleName: user.role.name,
        };
        next();
    }
    catch (error) {
        res.status(401).json({ status: 'error', message: 'Invalid token' });
    }
});
exports.authenticate = authenticate;
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.roleName)) {
            res.status(403).json({ status: 'error', message: 'Forbidden: Insufficient permissions' });
            return;
        }
        next();
    };
};
exports.requireRole = requireRole;
