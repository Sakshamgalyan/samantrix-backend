import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Email, EmailDocument } from './entities/email.schema';
import {
  Verification,
  VerificationDocument,
} from './entities/verification.schema';
import { SendEmailDto } from 'src/dto/email/send-email.dto';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private gmailTransporter: nodemailer.Transporter;

  constructor(
    @InjectModel(Email.name) private emailModel: Model<EmailDocument>,
    @InjectModel(Verification.name)
    private verificationModel: Model<VerificationDocument>,
  ) {
    // Configure Gmail SMTP
    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      this.gmailTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD,
        },
      });
      this.logger.log('Gmail SMTP configured successfully');
    } else {
      this.logger.warn('GMAIL_USER or GMAIL_APP_PASSWORD is not defined');
    }
  }

  /**
   * Read HTML template and replace placeholders
   */
  private readTemplate(
    templateName: string,
    replacements: Record<string, string>,
  ): string {
    const templatePath = path.join(
      process.cwd(),
      'src',
      'common',
      'templete',
      `${templateName}.html`,
    );
    let template = fs.readFileSync(templatePath, 'utf-8');

    // Replace all placeholders
    Object.keys(replacements).forEach((key) => {
      const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
      template = template.replace(regex, replacements[key]);
    });

    return template;
  }

  async sendEmail(
    files: Array<Express.Multer.File>,
    sendEmailDto: SendEmailDto,
    senderId: string,
  ) {
    const attachments = files ? files.map((file) => file.path) : [];
    this.logger.log(
      `Sending email to ${sendEmailDto.to} from ${senderId}, subject: '${sendEmailDto.subject}', attachments: ${files?.length || 0}`,
    );

    try {
      if (!process.env.GMAIL_USER) {
        throw new Error('GMAIL_USER is not defined');
      }

      // Read email template and replace placeholders
      const htmlContent = this.readTemplate('sendEmail', {
        subject: sendEmailDto.subject,
        message: sendEmailDto.message,
      });

      // Updating to read file content for SendGrid
      const sgAttachments = (files || [])
        .map((file) => {
          try {
            return {
              content: fs.readFileSync(file.path).toString('base64'),
              filename: file.originalname,
              type: file.mimetype,
              disposition: 'attachment',
            };
          } catch (err) {
            this.logger.error(
              `Failed to read file ${file.path}: ${err.message}`,
            );
            return null;
          }
        })
        .filter((attachment) => attachment !== null) as any;

      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: sendEmailDto.to,
        subject: sendEmailDto.subject,
        html: htmlContent,
        attachments: sgAttachments,
      };

      await this.gmailTransporter.sendMail(mailOptions);
      this.logger.log(`Email sent successfully to ${sendEmailDto.to}`);
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${sendEmailDto.to}: ${error.message}`,
        error?.response?.body,
      );
      throw error;
    }

    const newEmail = new this.emailModel({
      ...sendEmailDto,
      senderId,
      attachments,
      status: 'sent',
    });

    await newEmail.save();

    this.logger.log(`Email sent to ${sendEmailDto.to} by ${senderId}`);

    return {
      message: 'Email sent successfully',
      data: newEmail,
    };
  }

  async getHistory(senderId: string, page: number = 1, limit: number = 10) {
    this.logger.debug(
      `Fetching email history for sender ${senderId}, page: ${page}, limit: ${limit}`,
    );
    const skip = (page - 1) * limit;
    const query = { senderId };

    const [emails, total] = await Promise.all([
      this.emailModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.emailModel.countDocuments(query).exec(),
    ]);

    this.logger.log(
      `Found ${emails.length} emails for sender ${senderId} (total: ${total})`,
    );
    return {
      data: emails,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Generate a random 6-digit OTP
   */
  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send OTP to user's email
   */
  async sendOTP(email: string, userId: string): Promise<void> {
    if (!this.gmailTransporter) {
      throw new BadRequestException('Gmail SMTP is not configured');
    }

    // Generate OTP
    const otp = this.generateOTP();

    // Calculate expiry time (default 10 minutes)
    const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES || '10');
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    // Save new OTP to database
    const verification = new this.verificationModel({
      email,
      userId,
      otp,
      expiresAt,
      useCount: 0,
      isUsed: false,
    });
    await verification.save();

    // Read OTP template and replace placeholders
    const htmlContent = this.readTemplate('sendOtp', {
      otp,
      expiryMinutes: expiryMinutes.toString(),
    });

    // Send OTP via Gmail
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: email,
      subject: 'Email Verification - OTP',
      html: htmlContent,
    };

    try {
      await this.gmailTransporter.sendMail(mailOptions);
      this.logger.log(`OTP sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send OTP to ${email}: ${error.message}`);
      throw new BadRequestException('Failed to send OTP email');
    }
  }

  /**
   * Verify OTP
   */
  async verifyOTP(email: string, otp: string): Promise<string> {
    // Find the verification record
    const verification = await this.verificationModel.findOne({
      email,
      otp,
      isUsed: false,
    });

    if (!verification) {
      throw new BadRequestException('Invalid OTP');
    }

    // Check if OTP is expired
    if (new Date() > verification.expiresAt) {
      throw new BadRequestException('OTP has expired');
    }

    // Increment use count and mark as used if it reaches 2
    verification.useCount += 1;
    if (verification.useCount >= 2) {
      verification.isUsed = true;
    }
    await verification.save();

    this.logger.log(
      `OTP verified successfully for ${email} (Use count: ${verification.useCount})`,
    );
    return verification.userId.toString();
  }
}
