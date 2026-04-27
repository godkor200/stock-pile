export interface CreateUserDto {
  email: string;
  password: string;
}

export interface UserResponseDto {
  id: string;
  email: string;
  telegramUserId: string | null;
  createdAt: Date;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthTokenDto {
  accessToken: string;
  user: UserResponseDto;
}
