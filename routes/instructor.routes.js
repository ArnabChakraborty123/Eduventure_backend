import express from 'express';
import { loginInstructor, logoutInstructor, authenticateInstructor, hashPassword } from '../controllers/instructorAuth.js';
import { checkInstructorAuth } from '../middleware/InstructorAuth.middleware.js';
import Instructor from '../models/instructor.models.js';
import Course from '../models/course.models.js';
const router = express.Router();
import StudentCourse from '../models/studentCourse.model.js';
import { UserModel } from '../models/user.models.js';
// In your instructor routes file

// Instructor Registration - Removed checkInstructorAuth middleware
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, profilePicture, bio } = req.body;

    const existingInstructor = await Instructor.findOne({ email });
    if (existingInstructor) {
      return res.status(400).json({ msg: 'Instructor already exists with this email' });
    }

    const hashedPassword = await hashPassword(password);
    const newInstructor = await Instructor.create({
      name,
      email,
      password: hashedPassword,
      profilePicture,
      bio
    });

    const token = await authenticateInstructor(newInstructor._id);

    res.status(201).json({ token, instructor: { _id: newInstructor._id, name, email, profilePicture, bio } });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ msg: 'Internal server error', error: error.message });
  }
});

// Instructor Login - Removed checkInstructorAuth middleware
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const instructor = await loginInstructor({ email, password });

    if (!instructor) {
      return res.status(401).json({ msg: 'Invalid email or password' });
    }

    const token = await authenticateInstructor(instructor._id);

    res.json({ token, instructor: { _id: instructor._id, name: instructor.name, email: instructor.email, profilePicture: instructor.profilePicture, bio: instructor.bio } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ msg: 'Internal server error', error: error.message });
  }
});

// Instructor Logout - Keep checkInstructorAuth for protected routes
router.post('/logout', checkInstructorAuth, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ msg: 'Token is required for logout' });
    }

    const success = await logoutInstructor(token);
    if (!success) {
      return res.status(400).json({ msg: 'Logout failed, session not found' });
    }

    res.json({ msg: 'Logout successful' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Internal server error', error: error.message });
  }
});

router.get("/", checkInstructorAuth, async (req, res) => {
  try {
    // req.instructor is set in checkInstructorAuth middleware
    const instructorId = req.instructor._id;

    if (!instructorId) {
      return res.status(401).json({ error: "Unauthorized: No instructor ID found" });
    }

    const courses = await Course.find({ instructor: instructorId })
      .populate("instructor", "_id name email") 
      .sort({ createdAt: -1 })
      .select("_id title visibility createdAt price category instructor");

    res.status(200).json(courses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route to get all students (for enrollment dropdown)
router.get('/all-students', checkInstructorAuth, async (req, res) => {
  try {
    // Get all students/users available in the system
    const students = await UserModel.manager.find({})
      .select('_id name email')
      .sort({ name: 1 });
    
    res.status(200).json(students);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// New route to get enrollments for instructor's courses
router.get("/enrollments", checkInstructorAuth, async (req, res) => {
  try {
    const instructorId = req.instructor._id;

    if (!instructorId) {
      return res.status(401).json({ error: "Unauthorized: No instructor ID found" });
    }

    // First, get all courses by this instructor
    const instructorCourses = await Course.find({ instructor: instructorId })
      .select("_id");

    const courseIds = instructorCourses.map(course => course._id);

    // Then find all student enrollments for these courses
    const enrollments = await StudentCourse.find({
      course: { $in: courseIds }
    })
      .populate('student', '_id name')
      .populate('course', '_id price')
      .select('student course purchased_at completedLessons completed_at');

    res.status(200).json(enrollments);
  } catch (error) {
    console.error("Error fetching instructor enrollments:", error);
    res.status(500).json({ error: error.message });
  }
});

// Add these routes to your instructorRoutes.js file

// Get current instructor profile (authenticated route)
router.get("/me", checkInstructorAuth, async (req, res) => {
  try {
    // req.instructor is set in checkInstructorAuth middleware
    const instructorId = req.instructor._id;

    if (!instructorId) {
      return res.status(401).json({ error: "Unauthorized: No instructor ID found" });
    }

    const instructor = await Instructor.findById(instructorId)
      .select("-password") // Exclude password from response

    if (!instructor) {
      return res.status(404).json({ error: "Instructor not found" });
    }

    res.status(200).json(instructor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Public route to get list of all instructors' name and email
router.get("/list/basic", async (req, res) => {
  try {
    const instructors = await Instructor.find({})
      .select("name email"); // Only fetch name and email

    res.status(200).json(instructors);
  } catch (error) {
    console.error("Error fetching instructors:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get instructor by ID - public route
router.get("/:id", async (req, res) => {
  try {
    const instructor = await Instructor.findById(req.params.id)
      .select("-password"); // Exclude password from the response

    if (!instructor) {
      return res.status(404).json({ error: "Instructor not found" });
    }

    res.status(200).json(instructor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update instructor bio - protected route
router.put("/update-bio", checkInstructorAuth, async (req, res) => {
  try {
    const { bio } = req.body;
    const instructorId = req.instructor._id;

    if (bio === undefined) {
      return res.status(400).json({ error: "Bio is required" });
    }

    const updatedInstructor = await Instructor.findByIdAndUpdate(
      instructorId,
      { bio },
      { new: true }
    ).select("-password");

    res.status(200).json(updatedInstructor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Add this to your instructor routes file
router.post('/add-user', checkInstructorAuth, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    // Check if user already exists
    const existingUser = await UserModel.manager.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Hash the password
    const hashedPassword = await hashPassword(password);

    // Create the new user
    const newUser = await UserModel.manager.create({
      name,
      email,
      password: hashedPassword
    });

    // Return the created user (excluding password)
    const userData = {
      _id: newUser._id,
      name: newUser.name,
      email: newUser.email
    };

    res.status(201).json({ 
      message: 'User created successfully',
      user: userData 
    });

  } catch (error) {
    console.error('User creation error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// Route to enroll a student in a course
router.post('/enroll-student', checkInstructorAuth, async (req, res) => {
  try {
    const { studentId, courseId } = req.body;
    const instructorId = req.instructor._id;
    
    if (!studentId || !courseId) {
      return res.status(400).json({ message: 'Student ID and Course ID are required' });
    }
    
    // Verify that the course belongs to the instructor
    const course = await Course.findOne({ _id: courseId, instructor: instructorId });
    if (!course) {
      return res.status(403).json({ message: 'Course not found or you do not have permission to enroll students in this course' });
    }
    
    // Check if the student exists
    const student = await UserModel.manager.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    
    // Check if the student is already enrolled in this course
    const existingEnrollment = await StudentCourse.findOne({
      student: studentId,
      course: courseId
    });
    
    if (existingEnrollment) {
      return res.status(400).json({ message: 'Student is already enrolled in this course' });
    }
    
    // Calculate expiration date if the course has a validity period
    let expiresAt = null;
    if (course.validityPeriod && course.validityPeriod.type !== 'none' && course.validityPeriod.duration > 0) {
      expiresAt = new Date();
      const { type, duration } = course.validityPeriod;
      
      switch (type) {
        case 'days':
          expiresAt.setDate(expiresAt.getDate() + duration);
          break;
        case 'weeks':
          expiresAt.setDate(expiresAt.getDate() + (duration * 7));
          break;
        case 'months':
          expiresAt.setMonth(expiresAt.getMonth() + duration);
          break;
        case 'years':
          expiresAt.setFullYear(expiresAt.getFullYear() + duration);
          break;
        default:
          expiresAt = null;
      }
    }
    
    // Initialize empty completedLessons array
    // First get all lessons in the course to initialize tracking
    const courseWithLessons = await Course.findById(courseId).populate('lesson');
    const completedLessons = courseWithLessons.lesson.map(lesson => ({
      lesson: lesson._id,
      completed_at: null
    }));
    
    // Create new enrollment
    const newEnrollment = await StudentCourse.create({
      student: studentId,
      course: courseId,
      purchased_at: new Date(),
      expiresAt,
      completedLessons: completedLessons,
      recent_access: new Date()
    });
    
    // Populate the enrollment with student and course details for the response
    await newEnrollment.populate([
      { path: 'student', select: '_id name email' },
      { path: 'course', select: '_id title price' }
    ]);
    
    res.status(201).json({ 
      message: 'Student enrolled successfully', 
      enrollment: newEnrollment 
    });
    
  } catch (error) {
    console.error('Error enrolling student:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// Route to get all courses (for enrollment dropdown)
router.get('/courses', checkInstructorAuth, async (req, res) => {
  try {
    const instructorId = req.instructor._id;
    
    // Get all courses belonging to the instructor
    const courses = await Course.find({ instructor: instructorId })
      .select('_id title price category')
      .sort({ title: 1 });
    
    res.status(200).json(courses);
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


export default router;