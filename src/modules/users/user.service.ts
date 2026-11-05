import { IUserRepository, userRepository } from "./user.repository";
import { CreateUserDTO, UpdateUserDTO, User } from "./user.types";
import { ConflictError, NotFoundError } from "../../shared/errors/app-error";

export class UserService {
  constructor(private readonly repo: IUserRepository = userRepository) {}

  public async getAllUsers(): Promise<User[]> {
    return this.repo.findAll();
  }

  public async getUserById(id: string): Promise<User> {
    const user = await this.repo.findById(id);
    if (!user) {
      throw new NotFoundError(`User with ID ${id} not found`);
    }
    return user;
  }

  public async createUser(data: CreateUserDTO): Promise<User> {
    const existing = await this.repo.findByEmail(data.email);
    if (existing) {
      throw new ConflictError(`User with email "${data.email}" already exists`);
    }

    return this.repo.create(data);
  }

  public async updateUser(id: string, data: UpdateUserDTO): Promise<User> {
    const updated = await this.repo.update(id, data);
    if (!updated) {
      throw new NotFoundError(`User with ID ${id} not found`);
    }
    return updated;
  }

  public async deleteUser(id: string): Promise<void> {
    const deleted = await this.repo.delete(id);
    if (!deleted) {
      throw new NotFoundError(`User with ID ${id} not found`);
    }
  }
}

export const userService = new UserService();

