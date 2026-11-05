"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRepository = exports.InMemoryUserRepository = void 0;
class InMemoryUserRepository {
    users = [];
    async findAll() {
        return [...this.users];
    }
    async findById(id) {
        return this.users.find((u) => u.id === id) || null;
    }
    async findByEmail(email) {
        return this.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
    }
    async create(data) {
        const newUser = {
            id: Math.random().toString(36).substring(2, 9),
            name: data.name,
            email: data.email,
            role: data.role || "user",
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.users.push(newUser);
        return newUser;
    }
    async update(id, data) {
        const userIndex = this.users.findIndex((u) => u.id === id);
        if (userIndex === -1)
            return null;
        const existing = this.users[userIndex];
        if (!existing)
            return null;
        const updatedUser = {
            ...existing,
            ...data,
            updatedAt: new Date(),
        };
        this.users[userIndex] = updatedUser;
        return updatedUser;
    }
    async delete(id) {
        const initialLength = this.users.length;
        this.users = this.users.filter((u) => u.id !== id);
        return this.users.length < initialLength;
    }
}
exports.InMemoryUserRepository = InMemoryUserRepository;
exports.userRepository = new InMemoryUserRepository();
//# sourceMappingURL=user.repository.js.map