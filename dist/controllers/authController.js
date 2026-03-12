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
exports.getMe = exports.login = exports.register = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("../prisma"));
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const register = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, password, name, roleName } = req.body;
    if (!email || !password || !name || !roleName) {
        res.status(400).json({ status: 'error', message: 'All fields are required' });
        return;
    }
    // Find or create the role
    let role = yield prisma_1.default.role.findUnique({ where: { name: roleName } });
    if (!role) {
        role = yield prisma_1.default.role.create({
            data: { name: roleName, description: `${roleName} Role` },
        });
    }
    // Check if user exists
    const existingUser = yield prisma_1.default.user.findUnique({ where: { email } });
    if (existingUser) {
        res.status(400).json({ status: 'error', message: 'User already exists' });
        return;
    }
    const hashedPassword = yield bcrypt_1.default.hash(password, 10);
    const user = yield prisma_1.default.user.create({
        data: {
            email,
            password: hashedPassword,
            name,
            roleId: role.id,
        },
        include: { role: true },
    });
    const token = jsonwebtoken_1.default.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1d' });
    res.status(201).json({
        status: 'success',
        data: {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role.name,
            },
            token,
        },
    });
});
exports.register = register;
const login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, password } = req.body;
    if (!email || !password) {
        res.status(400).json({ status: 'error', message: 'Email and password are required' });
        return;
    }
    const user = yield prisma_1.default.user.findUnique({
        where: { email },
        include: { role: true },
    });
    if (!user) {
        res.status(401).json({ status: 'error', message: 'Invalid credentials' });
        return;
    }
    const isPasswordValid = yield bcrypt_1.default.compare(password, user.password);
    if (!isPasswordValid) {
        res.status(401).json({ status: 'error', message: 'Invalid credentials' });
        return;
    }
    const token = jsonwebtoken_1.default.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1d' });
    res.status(200).json({
        status: 'success',
        data: {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role.name,
            },
            token,
        },
    });
});
exports.login = login;
const getMe = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    const user = yield prisma_1.default.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
    if (!user) {
        res.status(404).json({ status: 'error', message: 'User not found' });
        return;
    }
    res.status(200).json({ status: 'success', data: { user } });
});
exports.getMe = getMe;
