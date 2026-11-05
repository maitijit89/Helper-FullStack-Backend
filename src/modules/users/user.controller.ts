import { Request, Response } from "express";
import { userService, UserService } from "./user.service";
import { asyncHandler } from "../../shared/utils/async-handler";
import { sendResponse } from "../../shared/utils/api-response";
import { BadRequestError } from "../../shared/errors/app-error";

export class UserController {
  constructor(private readonly service: UserService = userService) {}

  public getAll = asyncHandler(async (_req: Request, res: Response) => {
    const users = await this.service.getAllUsers();
    sendResponse(res, {
      statusCode: 200,
      message: "Users retrieved successfully",
      data: users,
      meta: { total: users.length },
    });
  });

  public getById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id || typeof id !== "string") {
      throw new BadRequestError("Valid user ID is required");
    }

    const user = await this.service.getUserById(id);
    sendResponse(res, {
      statusCode: 200,
      message: "User retrieved successfully",
      data: user,
    });
  });

  public create = asyncHandler(async (req: Request, res: Response) => {
    const { name, email, role } = req.body;
    if (!name || !email) {
      throw new BadRequestError("Name and email are required fields");
    }

    const newUser = await this.service.createUser({ name, email, role });
    sendResponse(res, {
      statusCode: 201,
      message: "User created successfully",
      data: newUser,
    });
  });

  public update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id || typeof id !== "string") {
      throw new BadRequestError("Valid user ID is required");
    }

    const updatedUser = await this.service.updateUser(id, req.body);
    sendResponse(res, {
      statusCode: 200,
      message: "User updated successfully",
      data: updatedUser,
    });
  });

  public remove = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id || typeof id !== "string") {
      throw new BadRequestError("Valid user ID is required");
    }

    await this.service.deleteUser(id);
    sendResponse(res, {
      statusCode: 200,
      message: "User deleted successfully",
    });
  });
}

export const userController = new UserController();
