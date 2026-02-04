import mongoose from 'mongoose';
import { UserBase } from '../controllers/auth.js';

export class UserModel extends UserBase {

  static model = mongoose.model(
    'User',
    new mongoose.Schema(
      {
        name: {
          type: String,
          required: [true, 'User Name required'],
          trim: true,
          minlength: 2,
          maxlength: 50,
        },
        email: {
          type: String,
          required: [true, 'User Email is required'],
          unique: true,
          trim: true,
          lowercase: true,
          match: [/\S+@\S+\.\S+/, 'Please fill a valid email address'],
        },
        password: {
          type: String,
          required: [true, 'User Password is required'],
          minlength: 6,
        },
      },
      { timestamps: true }
    )
  );
  static manager=this.getModel();

  static getModel() {
    return this.model;
  }
}
