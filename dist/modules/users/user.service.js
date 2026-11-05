"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userService = exports.UserService = void 0;
const user_repository_1 = require("./user.repository");
const app_error_1 = require("../../shared/errors/app-error");
class UserService {
    repo;
    constructor(repo = user_repository_1.userRepository) {
        this.repo = repo;
    }
    async getAllUsers() {
        return this.repo.findAll();
    }
    async getUserById(id) {
        const user = await this.repo.findById(id);
        if (!user) {
            throw new app_error_1.NotFoundError(`User with ID ${id} not found`);
        }
        return user;
    }
    async createUser(data) {
        const existing = await this.repo.findByEmail(data.email);
        if (existing) {
            throw new app_error_1.ConflictError(`User with email "${data.email}" already exists`);
        }
        return this.repo.create(data);
    }
    async updateUser(id, data) {
        const updated = await this.repo.update(id, data);
        if (!updated) {
            throw new app_error_1.NotFoundError(`User with ID ${id} not found`);
        }
        return updated;
    }
    async deleteUser(id) {
        const deleted = await this.repo.delete(id);
        if (!deleted) {
            throw new app_error_1.NotFoundError(`User with ID ${id} not found`);
        }
    }
}
exports.UserService = UserService;
exports.userService = new UserService();
//# sourceMappingURL=user.service.js.map