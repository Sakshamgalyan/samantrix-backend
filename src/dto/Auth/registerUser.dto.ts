import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

export class RegisterUserDto {
  @IsString()
  name: string;

  @IsString()
  mobileNo: string;

  @IsString()
  post: string;

  @IsEmail()
  email: string;

  @MinLength(6)
  password: string;

  @IsOptional()
  @IsString()
  role: string = 'user';
}
