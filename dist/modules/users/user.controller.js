"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userController = exports.UserController = void 0;
const user_service_1 = require("./user.service");
const async_handler_1 = require("../../shared/utils/async-handler");
const api_response_1 = require("../../shared/utils/api-response");
const app_error_1 = require("../../shared/errors/app-error");
class UserController {
    service;
    constructor(service = user_service_1.userService) {
        this.service = service;
    }
    getAll = (0, async_handler_1.asyncHandler)(async (_req, res) => {
        const users = await this.service.getAllUsers();
        (0, api_response_1.sendResponse)(res, {
            statusCode: 200,
            message: "Users retrieved successfully",
            data: users,
            meta: { total: users.length },
        });
    });
    getById = (0, async_handler_1.asyncHandler)(async (req, res) => {
        const { id } = req.params;
        if (!id || typeof id !== "string") {
            throw new app_error_1.BadRequestError("Valid user ID is required");
        }
        const user = await this.service.getUserById(id);
        (0, api_response_1.sendResponse)(res, {
            statusCode: 200,
            message: "User retrieved successfully",
            data: user,
        });
    });
    create = (0, async_handler_1.asyncHandler)(async (req, res) => {
        const { name, email, role } = req.body;
        if (!name || !email) {
            throw new app_error_1.BadRequestError("Name and email are required fields");
        }
        const newUser = await this.service.createUser({ name, email, role });
        (0, api_response_1.sendResponse)(res, {
            statusCode: 201,
            message: "User created successfully",
            data: newUser,
        });
    });
    update = (0, async_handler_1.asyncHandler)(async (req, res) => {
        const { id } = req.params;
        if (!id || typeof id !== "string") {
            throw new app_error_1.BadRequestError("Valid user ID is required");
        }
        const updatedUser = await this.service.updateUser(id, req.body);
        (0, api_response_1.sendResponse)(res, {
            statusCode: 200,
            message: "User updated successfully",
            data: updatedUser,
        });
    });
    remove = (0, async_handler_1.asyncHandler)(async (req, res) => {
        const { id } = req.params;
        if (!id || typeof id !== "string") {
            throw new app_error_1.BadRequestError("Valid user ID is required");
        }
        await this.service.deleteUser(id);
        (0, api_response_1.sendResponse)(res, {
            statusCode: 200,
            message: "User deleted successfully",
        });
    });
}
exports.UserController = UserController;
exports.userController = new UserController();
//# sourceMappingURL=user.controller.js.map