import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class LoginUserDto {
  @IsString({ message: 'Invalid identifier format' })
  @IsNotEmpty({ message: 'Email or Mobile Number is required' })
  identifier: string;

  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}
