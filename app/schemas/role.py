from enum import Enum


class UserRole(str, Enum):
    USER = "user"
    PARTNER = "partner"
    ADMIN = "admin"
