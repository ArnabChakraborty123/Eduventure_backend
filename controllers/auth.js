// import User from '../models/user.model.js';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { UserModel } from '../models/user.models.js';
import { SessionModel } from '../models/session.models.js';
export class  UserBase{
  // use by user model to have some methods

  constructor() {
    this.model="" // model
  }
  static async createUser(userData) {
    // not ready to use
    return await this.model.create(userData);
  }
  static async showall(){
    return await this.model.find();
  }
  static getModel(){
    return this.model
  }
};

export async function hashPassword(password) {
  const hash = crypto.createHash('sha256');
  hash.update(password);
  // console.log("here is the hash",hash)
  return hash.digest('hex');
};


export async function login({ email, password }){
    try {
      const hashedPassword =await hashPassword(password);
      const user = await UserModel.model.findOne({ email:email,password:  hashedPassword });
      if (!user) {
      return null
      }
      else{
        return user
      }      
    } catch (err) {
      console.error("error login", err)
    }
  }


export async function logout(token) {
  try {
    const session = await SessionModel.findOneAndDelete({ token:token });
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
 
export async function Authentication(userId) {
  const token = uuidv4();
  const session = new SessionModel({
      userId,
      token
  });

  await session.save();
  return token;
}

  // try {
  //   const users = await User.find().select('-password');
  //   res.status(200).json({ success: true, data: users });
  // } catch (error) {
  //   next(error);
  // }
// };

// export const getUser = async (req, res, next) => {
//   try {
//     const user = await User.findById(req.params.id).select('-password');

//     if (!user) {
//       const error = new Error('User not found');
//       error.statusCode = 404;
//       throw error;
//     }

//     res.status(200).json({ success: true, data: user });
//   } catch (error) {
//     next(error);
//   }
// };
// const hashPassword = (password) => {
//     const hash = crypto.createHash('sha256');
//     hash.update(password);
//     // console.log("here is the hash",hash)
//     return hash.digest('hex');
//   };



// export const login = async (req, res, next) => {
//   try {
//     const { email, password } = req.body;
//     const hashedPassword = hashPassword(password);
//     console.log(hashedPassword)
//     // Find user by email
//     const user = await User.findOne({ email:email,password:  hashedPassword });

//     if (!user) {
//       return res.status(401).json({
//         success: false,
//         message: 'Invalid email or password'
//       });
//     }
//     // const hashedPassword = hashPassword(password);
// console.log(hashedPassword);
//     // Compare the hashed passwords
//     if (hashedPassword !== user.password) {
//         return res.status(401).json({
//           success: false,
//           message: 'Invalid email or password'
//         });
//       }
  
//     res.status(200).json({
//       success: true,
//       message: 'Login successful',
//       user: {
//         name: user.name,
//         email: user.email
//       }
//     });
//   } catch (error) {
//     next(error);
//   }
// };



  
// export const register = async (req, res, next) => {
//   try {
//     const { name, email, password } = req.body;

//     const existingUser = await User.findOne({ email });
//     if (existingUser) {
//       return res.status(400).json({
//         success: false,
//         message: 'User with this email already exists'
//       });
//     }
//     const hashedPassword = hashPassword(password);
//     console.log(hashedPassword)
//      console.log("view is runing")
//      console.log("here is the passworeds",hashedPassword);
//     const newUser = await User.create({
//       name,
//       email,
//       password: hashedPassword,
       
//     });

//     res.status(201).json({
//       success: true,
//       message: 'User registered successfully',
//       user: {
//         name: newUser.name,
//         email: newUser.email
//       }
//     });
//   } catch (error) {
//     if (error.name === 'ValidationError') {
//       const messages = Object.values(error.errors).map(val => val.message);
//       return res.status(400).json({
//         success: false,
//         message: messages.join(', ')
//       });
//     }
//     next(error);
//   }
// };


// import User from '../models/user.model.js';

// export const getUsers = async (req, res, next) => {
//   try {
//     const users = await User.find().select('-password');
//     res.status(200).json({ success: true, data: users });
//   } catch (error) {
//     next(error);
//   }
// };

// export const getUser = async (req, res, next) => {
//   try {
//     const user = await User.findById(req.params.id).select('-password');

//     if (!user) {
//       const error = new Error('User not found');
//       error.statusCode = 404;
//       throw error;
//     }

//     res.status(200).json({ success: true, data: user });
//   } catch (error) {
//     next(error);
//   }
// };

// export const login = async (req, res, next) => {
//   try {
//     const { email, password } = req.body;

//     const user = await User.findOne({ email });

//     if (!user || user.password !== password) {
//       return res.status(401).json({
//         success: false,
//         message: 'Invalid email or password'
//       });
//     }

//     res.status(200).json({
//       success: true,
//       message: 'Login successful',
//       user: {
//         name: user.name,
//         email: user.email
//       }
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// export const register = async (req, res, next) => {
//   try {
//     const { name, email, password } = req.body;

//     const existingUser = await User.findOne({ email });
//     if (existingUser) {
//       return res.status(400).json({
//         success: false,
//         message: 'User with this email already exists'
//       });
//     }

//     const newUser = await User.create({
//       name,
//       email,
//       password 
//     });

//     res.status(201).json({
//       success: true,
//       message: 'User registered successfully',
//       user: {
//         name: newUser.name,
//         email: newUser.email
//       }
//     });
//   } catch (error) {
//     if (error.name === 'ValidationError') {
//       const messages = Object.values(error.errors).map(val => val.message);
//       return res.status(400).json({
//         success: false,
//         message: messages.join(', ')
//       });
//     }
//     next(error);
//   }
// };