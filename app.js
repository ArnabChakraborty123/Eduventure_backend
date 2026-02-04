// app.js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from './database/mongodb.js';
import userRoutes from './routes/user.routes.js';
import reviewRoutes from './routes/review.routes.js';
import cartRoutes from "./routes/cart.routes.js";
import topCourseRoutes from './routes/topcourses.routes.js'
// import authRoutes from './routes/user.routes.js'; // Import the new auth routes
import cors from "cors";
import courseRoutes from "./routes/course.routes.js";
import notificationRoutes from './routes/notification.routes.js';
import faqRoutes from './routes/faq.routes.js'; // Added FAQ routes
import instructorRoutes from './routes/instructor.routes.js';
import dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,               // Allow credentials (cookies, authorization headers)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

console.log('Public directory path:', path.join(__dirname, 'public'));

// app.use(express.static(path.join(__dirname, 'public')));

app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));


// API routes
app.use('/api', userRoutes);
app.use("/api/courses", courseRoutes);
app.use('/api/topcourses', topCourseRoutes); 
app.use('/api/reviews', reviewRoutes);
app.use("/api/cart", cartRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/faqs', faqRoutes); 
app.use('/api/instructor', instructorRoutes);

// app.use('/api/certificates', certificateRoutes);


app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Server Error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

connectDB()
  .then(() => {
    app.listen(5000, () => console.log("🚀 Server running on port 5000"));
  })
  .catch((error) => {
    console.error("Error connecting to database:", error);
    process.exit(1); 
  });
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Login route
// app.get('/login', (req, res) => {
//   res.sendFile(path.join(__dirname, 'public', 'login.html'));
// });

// API routes
// app.use('/api', userRoutes);

// app.get('/signup', (req, res) => {
//   res.sendFile(path.join(__dirname, 'public', 'signup.html'));
// });