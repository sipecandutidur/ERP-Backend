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
exports.deleteUser = exports.updateUser = exports.getUserById = exports.getUsers = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const prisma_1 = __importDefault(require("../prisma"));
const getUsers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const users = yield prisma_1.default.user.findMany({
        select: {
            id: true,
            email: true,
            name: true,
            role: { select: { id: true, name: true } },
            createdAt: true,
        },
    });
    res.status(200).json({ status: 'success', data: { users } });
});
exports.getUsers = getUsers;
const getUserById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const user = yield prisma_1.default.user.findUnique({
        where: { id },
        select: {
            id: true,
            email: true,
            name: true,
            role: { select: { id: true, name: true } },
            createdAt: true,
        },
    });
    if (!user) {
        res.status(404).json({ status: 'error', message: 'User not found' });
        return;
    }
    res.status(200).json({ status: 'success', data: { user } });
});
exports.getUserById = getUserById;
const updateUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { name, roleId, password } = req.body;
    const dataToUpdate = {};
    if (name)
        dataToUpdate.name = name;
    if (roleId)
        dataToUpdate.roleId = roleId;
    if (password) {
        dataToUpdate.password = yield bcrypt_1.default.hash(password, 10);
    }
    const user = yield prisma_1.default.user.update({
        where: { id },
        data: dataToUpdate,
        select: {
            id: true,
            email: true,
            name: true,
            role: { select: { id: true, name: true } },
        },
    });
    res.status(200).json({ status: 'success', data: { user } });
});
exports.updateUser = updateUser;
const deleteUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    yield prisma_1.default.user.delete({ where: { id } });
    res.status(204).send();
});
exports.deleteUser = deleteUser;
