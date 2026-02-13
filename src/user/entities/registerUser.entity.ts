import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Role } from 'src/common/Roles';

export type UserDocument = HydratedDocument<User>;

@Schema()
export class User {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  post: string;

  @Prop({ required: true, unique: true })
  mobileNo: string;

  @Prop({ required: true })
  password: string;

  @Prop({ default: Role.USER })
  role: string;

  @Prop()
  employeeId: string;

  @Prop({ default: Date.now() })
  createdOn: Date;

  @Prop({ default: Date.now() })
  updatedOn: Date;

  @Prop()
  refreshToken: string;

  @Prop({ default: false })
  isVerified: boolean;

  @Prop()
  profilePicture: string;

  @Prop({ default: 'Employee of Company' })
  description: string;

  @Prop()
  address: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.pre('save', async function () {
  if (this.isNew) {
    const lastUser = await (this.constructor as any)
      .findOne()
      .sort({ _id: -1 });
    if (lastUser && lastUser.employeeId) {
      const lastId = parseInt(lastUser.employeeId);
      this.employeeId = !isNaN(lastId) ? (lastId + 1).toString() : '1';
    } else {
      this.employeeId = '1';
    }
  }
});
