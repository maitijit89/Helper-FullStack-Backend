import { User, CreateUserDTO, UpdateUserDTO } from "./user.types";

export interface IUserRepository {
  findAll(): Promise<User[]>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(data: CreateUserDTO): Promise<User>;
  update(id: string, data: UpdateUserDTO): Promise<User | null>;
  delete(id: string): Promise<boolean>;
}

export class InMemoryUserRepository implements IUserRepository {
  private users: User[] = [];

  public async findAll(): Promise<User[]> {
    return [...this.users];
  }

  public async findById(id: string): Promise<User | null> {
    return this.users.find((u) => u.id === id) || null;
  }

  public async findByEmail(email: string): Promise<User | null> {
    return this.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  public async create(data: CreateUserDTO): Promise<User> {
    const newUser: User = {
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

  public async update(id: string, data: UpdateUserDTO): Promise<User | null> {
    const userIndex = this.users.findIndex((u) => u.id === id);
    if (userIndex === -1) return null;

    const existing = this.users[userIndex];
    if (!existing) return null;

    const updatedUser: User = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };

    this.users[userIndex] = updatedUser;
    return updatedUser;
  }

  public async delete(id: string): Promise<boolean> {
    const initialLength = this.users.length;
    this.users = this.users.filter((u) => u.id !== id);
    return this.users.length < initialLength;
  }
}

export const userRepository = new InMemoryUserRepository();

