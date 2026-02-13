import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from 'src/user/user.module';
import {
  Verification,
  VerificationSchema,
} from './entities/verification.schema';
import { Email, EmailSchema } from './entities/email.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Email.name, schema: EmailSchema },
      { name: Verification.name, schema: VerificationSchema },
    ]),
    UserModule,
  ],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
