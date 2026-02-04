import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { InstructorSessionModel } from '../models/session.models.js';
import Instructor from '../models/instructor.models.js';

// Hashing password
export async function hashPassword(password) {
  const hash = crypto.createHash('sha256');
  hash.update(password);
  return hash.digest('hex');
}

// Instructor Registration
export async function registerInstructor({ name, email, password, profilePicture, bio }) {
  try {
    const existingInstructor = await Instructor.findOne({ email });
    if (existingInstructor) {
      return { error: "Email already exists" };
    }

    const hashedPassword = await hashPassword(password);
    const instructor = await Instructor.create({
      name,
      email,
      password: hashedPassword,
      profilePicture,
      bio,
    });

    return instructor;
  } catch (err) {
    console.error("Error registering instructor:", err);
    return { error: "Registration failed" };
  }
}

// Instructor Login
export async function loginInstructor({ email, password }) {
  try {
    const hashedPassword = await hashPassword(password);
    const instructor = await Instructor.findOne({ email, password: hashedPassword });

    if (!instructor) {
      return null;
    }

    return instructor;
  } catch (err) {
    console.error("Error logging in instructor:", err);
  }
}

// Logout Instructor
export async function logoutInstructor(token) {
  try {
    const session = await InstructorSessionModel.findOneAndDelete({ token });
    if (!session) {
      console.error("No session found for token:", token);
      return false;
    }
    console.log("Session deleted successfully for token:", token);
    return true;
  } catch (error) {
    console.error("Error during logout:", error);
    return false;
  }
}

// Generate Auth Token
export async function authenticateInstructor(instructorId) {
  const token = uuidv4();
  const session = new InstructorSessionModel({
    instructorId: instructorId,
    token
  });

  await session.save();
  return token;
}
