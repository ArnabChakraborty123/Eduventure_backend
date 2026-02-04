import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log(`Connected to database in dev mode`);
    return true;
  } catch (error) {
    console.error('Error connecting to database: ', error);
    throw error;
  }
};

export default connectDB;
