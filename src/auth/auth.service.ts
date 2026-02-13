import {
  Injectable,
  ForbiddenException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RegisterUserDto } from 'src/dto/Auth/registerUser.dto';
import { UserService } from 'src/user/user.service';
import bcrypt from 'bcrypt';
import { LoginUserDto } from 'src/dto/Auth/loginUser.dto';
import { ConfigService } from '@nestjs/config';
import { EmailService } from 'src/email/email.service';
import { ResetPasswordDto } from 'src/dto/Auth/resetPassword.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async registerUser(registerDto: RegisterUserDto) {
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const user = await this.userService.createUser({
      ...registerDto,
      password: hashedPassword,
    });
    this.logger.log(`User registered: ${user.email} (ID: ${user._id})`);
    const tokens = await this.getTokens(user._id.toString(), user.role);
    await this.updateRefreshToken(user._id.toString(), tokens.refresh_token);
    return tokens;
  }

  async loginUser(loginDto: LoginUserDto) {
    const user = await this.userService.loginUser(loginDto);
    this.logger.log(`User logged in: ${user.email} (ID: ${user._id})`);
    const tokens = await this.getTokens(user._id.toString(), user.role);
    await this.updateRefreshToken(user._id.toString(), tokens.refresh_token);
    return tokens;
  }

  async logout(userId: string) {
    this.logger.log(`Logging out user: ${userId}`);
    return this.userService.updateRefreshToken(userId, null);
  }

  async refreshTokens(refreshToken: string) {
    let payload;
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch (error) {
      this.logger.warn(`Refresh token verification failed: ${error.message}`);
      throw new ForbiddenException('Access Denied');
    }

    const userId = payload.sub;
    this.logger.debug(`Refresh token verified for user: ${userId}`);
    const user = await this.userService.findById(userId);
    if (!user || !user.refreshToken) {
      this.logger.warn(
        `Refresh token validation failed for user: ${userId} - User not found or no refresh token`,
      );
      throw new ForbiddenException('Access Denied');
    }

    const refreshTokenMatches = await bcrypt.compare(
      refreshToken,
      user.refreshToken,
    );
    if (!refreshTokenMatches) {
      this.logger.warn(`Refresh token mismatch for user: ${userId}`);
      throw new ForbiddenException('Access Denied');
    }

    this.logger.log(`Generating new tokens for user: ${userId}`);
    const tokens = await this.getTokens(user._id.toString(), user.role);
    await this.updateRefreshToken(user._id.toString(), tokens.refresh_token);
    return tokens;
  }

  async updateRefreshToken(userId: string, refreshToken: string) {
    this.logger.debug(`Updating refresh token for user: ${userId}`);
    const hash = await bcrypt.hash(refreshToken, 10);
    await this.userService.updateRefreshToken(userId, hash);
  }

  async getTokens(userId: string, role: string) {
    this.logger.debug(
      `Generating access and refresh tokens for user: ${userId}`,
    );
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, role },
        {
          secret: this.configService.get<string>('JWT_SECRETKEY'),
          expiresIn: '15m',
        },
      ),
      this.jwtService.signAsync(
        { sub: userId, role },
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
          expiresIn: '7d',
        },
      ),
    ]);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async getProfile(userId: string) {
    this.logger.debug(`Fetching profile for user: ${userId}`);
    const data = await this.userService.findById(userId);
    if (!data) {
      this.logger.warn(`Profile not found for user: ${userId}`);
      throw new UnauthorizedException('User not found');
    }
    const user = {
      id: data._id,
      name: data.name,
      post: data.post,
      email: data.email,
      mobileNo: data.mobileNo,
      role: data.role,
      employeeId: data.employeeId,
      isVerified: data.isVerified,
      profilePicture: data.profilePicture,
      description: data.description,
      address: data.address,
    };
    return user;
  }

  async forgotPassword(email: string) {
    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    await this.emailService.sendOTP(email, user._id.toString());
    return { message: 'OTP sent successfully', status: 'success' };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { email, otp, password } = resetPasswordDto;
    this.logger.log(`Resetting password for email: ${email}`);
    await this.emailService.verifyOTP(email, otp);
    await this.userService.updatePassword(email, password);
    this.logger.log(`Password reset completed for email: ${email}`);
    return { message: 'Password reset successfully', status: 'success' };
  }

  async updateProfile(userId: string, updateProfileDto: any) {
    this.logger.log(`Updating profile for user: ${userId}`);
    return this.userService.updateProfile(userId, updateProfileDto);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    this.logger.log(`Changing password for user: ${userId}`);
    return this.userService.changePassword(
      userId,
      currentPassword,
      newPassword,
    );
  }

  async updateProfilePicture(userId: string, filename: string) {
    this.logger.log(
      `Updating profile picture for user: ${userId} to ${filename}`,
    );
    return this.userService.updateProfilePicture(userId, filename);
  }

  async searchEmployees(searchTerm: string, page: number, limit: number) {
    this.logger.debug(
      `Searching employees: term='${searchTerm}', page=${page}, limit=${limit}`,
    );
    return this.userService.searchEmployees(searchTerm, page, limit);
  }

  async getPublicProfile(employeeId: string) {
    this.logger.debug(`Fetching public profile for employeeId: ${employeeId}`);
    return this.userService.getPublicProfile(employeeId);
  }
}
