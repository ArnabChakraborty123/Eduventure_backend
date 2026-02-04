import express from 'express';
import { UserModel } from '../models/user.models.js';
import { login, logout } from '../controllers/auth.js';
import { Authentication, hashPassword } from '../controllers/auth.js';
import AuthMiddleware from '../middleware/auth.middleware.js';
import studentCourse from '../models/studentCourse.model.js'; // Import the studentCourse model
import Course from '../models/course.models.js';
const router = express.Router();
const authMiddleware = new AuthMiddleware('/logout');

router.get('/profile', authMiddleware.checkAuth, (req, res) => {
  const { _id, name, email } = req.user;
  res.json({
    message: 'User profile data',
    userId: _id,
    name,
    email
  });
});

router.put('/profile', authMiddleware.checkAuth, async (req, res) => {
  try {
    const { name, email } = req.body;
    const userId = req.user._id;

    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required' });
    }

    const existingUser = await UserModel.model.findOne({ email, _id: { $ne: userId } });
    if (existingUser) {
      return res.status(400).json({ message: 'Email is already in use' });
    }

    const updatedUser = await UserModel.model.findByIdAndUpdate(
      userId,
      { name, email },
      { new: true, runValidators: true }
    ).select('-password'); // Exclude password from response

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      message: 'Profile updated successfully',
      userId: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Server error during profile update' });
  }
});

router.post('/register', async (req, res) => { // Removed authMiddleware.checkAuth as it shouldn't be required for registration
  try {
    const { name, email, password, courseId } = req.body; // Added courseId if provided during registration

    const existingUser = await UserModel.manager.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ msg: 'User already exists with this email' });
    }

    const hashedPassword = await hashPassword(password);

    // Create the new user
    const newUser = await UserModel.manager.create({
      name,
      email,
      password: hashedPassword
    });
    console.log("new user", newUser);
    // If a courseId was provided, create a studentCourse entry
    if (courseId) {
      await studentCourse.create({
        student: newUser._id,
        course: courseId,
        purchased_at: new Date()
      });
    }

    const token = await Authentication(newUser._id);

    const userData = {
      _id: newUser._id,
      name: newUser.name,
      email: newUser.email
    };

    res.status(201).json({ token, user: userData });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ msg: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await login({ email, password });
    if (!user) {
      return res.status(401).json({ msg: 'Invalid email or password' });
    }

    const token = await Authentication(user._id);

    res.json({ token, user: { _id: user._id, name: user.name, email: user.email } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ msg: 'Internal server error' });
  }
});

// route to enroll a student in a course after they've registered
router.post('/enroll', authMiddleware.checkAuth, async (req, res) => {
  try {
    const { courseId } = req.body;
    const userId = req.user._id;

    // Check if user is already enrolled
    const existingEnrollment = await studentCourse.findOne({
      student: userId,
      course: courseId
    });

    if (existingEnrollment) {
      return res.status(400).json({
        msg: 'Student is already enrolled in this course',
        enrollment: {
          id: existingEnrollment._id,
          courseId: existingEnrollment.course,
          enrolledAt: existingEnrollment.purchased_at,
          expiresAt: existingEnrollment.expiresAt || null
        }
      });
    }

    // Get course details to check validity period
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ msg: 'Course not found' });
    }

    // Calculate expiration date if course has validity period
    let expiresAt = null;
    if (course.validityPeriod && course.validityPeriod.type !== 'none' && course.validityPeriod.duration > 0) {
      const now = new Date();
      expiresAt = new Date(now);
      
      switch (course.validityPeriod.type) {
        case 'days':
          expiresAt.setDate(now.getDate() + course.validityPeriod.duration);
          break;
        case 'weeks':
          expiresAt.setDate(now.getDate() + (course.validityPeriod.duration * 7));
          break;
        case 'months':
          expiresAt.setMonth(now.getMonth() + course.validityPeriod.duration);
          break;
        case 'years':
          expiresAt.setFullYear(now.getFullYear() + course.validityPeriod.duration);
          break;
      }
    }

    // Enrolling student with expiration date if applicable
    const enrollment = await studentCourse.create({
      student: userId,
      course: courseId,
      purchased_at: new Date(),
      expiresAt: expiresAt,
      recent_access: new Date()
    });

    res.status(201).json({
      msg: 'Student enrolled successfully',
      enrollment: {
        id: enrollment._id,
        courseId: enrollment.course,
        enrolledAt: enrollment.purchased_at,
        expiresAt: enrollment.expiresAt || null,
        validityPeriod: course.validityPeriod || { type: 'none', duration: 0 }
      }
    });

  } catch (error) {
    console.error('Enrollment error:', error);
    res.status(500).json({ msg: 'Internal server error' });
  }
});

router.get('/enrolled-courses', authMiddleware.checkAuth, async (req, res) => {
  try {
    const userId = req.user._id;

    // Find all courses the student is enrolled in that are not expired
    const enrolledCourses = await studentCourse.find({ 
      student: userId,
      isExpired: false  // Only return non-expired courses
    }).populate({
      path: 'course',
      populate: [
        {
          path: 'chapters',
          populate: {
            path: 'lessons'
          }
        },
        {
          path: 'instructor'
        }
      ]
    });

    console.log(`Found ${enrolledCourses.length} non-expired enrolled courses for user ${userId}`);

    const formattedCourses = await Promise.all(enrolledCourses.map(async (enrollment) => {
      if (!enrollment.course) return null;

      const course = enrollment.course;

      // Calculate total lessons across all chapters
      let totalLessons = 0;
      if (course.chapters && Array.isArray(course.chapters)) {
        course.chapters.forEach(chapter => {
          if (chapter && chapter.lessons && Array.isArray(chapter.lessons)) {
            totalLessons += chapter.lessons.length;
          }
        });
      }

      // Count completed lessons
      const completedLessons = Array.isArray(enrollment.completedLessons) 
        ? enrollment.completedLessons.length 
        : 0;

      // Get instructor name or use a fallback
      const instructorName = course.instructor?.name || 'Unknown Instructor';

      // Calculate progress percentage
      const progress = totalLessons > 0
        ? Math.round((completedLessons / totalLessons) * 100)
        : 0;

      // Check course expiry details
      const expiryInfo = enrollment.expiresAt 
        ? {
            expiresAt: enrollment.expiresAt,
            daysRemaining: Math.max(0, Math.ceil((new Date(enrollment.expiresAt) - new Date()) / (1000 * 60 * 60 * 24)))
          }
        : { unlimited: true };

      return {
        id: enrollment._id,
        courseId: course._id,
        title: course.title,
        instructor: instructorName,
        thumbnail: course.thumbnail || '/api/placeholder/320/180',
        description: course.description,
        enrolledAt: enrollment.purchased_at,
        progress: progress,
        completedModules: completedLessons,
        totalModules: totalLessons,
        isCompleted: progress === 100,
        // Add expiry information
        access: expiryInfo,
        // Optional: Add more details if needed
        rating: course.rating || 0,
        duration: course.duration || "Not specified"
      };
    }));

    // Filter out null values
    const validCourses = formattedCourses.filter(course => course !== null);

    return res.status(200).json({
      success: true,
      data: {
        totalCourses: validCourses.length,
        courses: validCourses
      }
    });
  } catch (error) {
    console.error('Enrolled courses error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});
// Certificate API endpoint - certificates.js
router.get('/certificates', authMiddleware.checkAuth, async (req, res) => {
  try {
    const userId = req.user._id;

    // Find all courses the student is enrolled in
    const enrolledCourses = await studentCourse.find({ student: userId })
      .populate({
        path: 'course',
        select: '_id title thumbnail chapters', // Include chapters for progress calculation
        populate: [
          {
            path: 'instructor',
            select: 'name'
          },
          {
            path: 'chapters',
            populate: {
              path: 'lessons',
              select: '_id' // Just need IDs to count lessons
            }
          }
        ]
      });

    console.log(`Found ${enrolledCourses.length} enrolled courses for user ${userId}`);
    
    // Process courses to get completed ones
    const completedCourses = enrolledCourses
      .filter(enrollment => {
        // Check if course and required data exist
        if (!enrollment.course) {
          console.log("Skipping enrollment - missing course data");
          return false;
        }
        
        try {
          // Calculate total lessons
          let totalLessons = 0;
          if (enrollment.course.chapters && Array.isArray(enrollment.course.chapters)) {
            enrollment.course.chapters.forEach(chapter => {
              if (chapter && chapter.lessons && Array.isArray(chapter.lessons)) {
                totalLessons += chapter.lessons.length;
              }
            });
          }
          
          // Count completed lessons
          const completedLessons = Array.isArray(enrollment.completedLessons) 
            ? enrollment.completedLessons.length 
            : 0;
          
          // Calculate progress percentage
          const progress = totalLessons > 0
            ? Math.round((completedLessons / totalLessons) * 100)
            : 0;
            
          console.log(`Course ${enrollment.course.title}: ${completedLessons}/${totalLessons} lessons, ${progress}% complete`);
          
          return progress === 100; // Only include 100% completed courses
        } catch (err) {
          console.error(`Error calculating progress for course ${enrollment.course._id}:`, err);
          return false;
        }
      })
      .map(enrollment => ({
        courseId: enrollment.course._id,
        courseTitle: enrollment.course.title,
        studentName: req.user.name, // Get student name from auth user
        completedDate: enrollment.purchased_at,
        thumbnail: enrollment.course.thumbnail || '/api/placeholder/320/180'
      }));

    console.log(`Returning ${completedCourses.length} completed courses as certificates`);
    
    // For testing: If no completed courses, include courses with at least 50% progress
    if (completedCourses.length === 0) {
      console.log("No completed courses found, adding courses with at least 50% progress for testing");
      
      const partiallyCompletedCourses = enrolledCourses
        .filter(enrollment => {
          if (!enrollment.course) return false;
          
          try {
            // Calculate total lessons
            let totalLessons = 0;
            if (enrollment.course.chapters && Array.isArray(enrollment.course.chapters)) {
              enrollment.course.chapters.forEach(chapter => {
                if (chapter && chapter.lessons && Array.isArray(chapter.lessons)) {
                  totalLessons += chapter.lessons.length;
                }
              });
            }
            
            // Count completed lessons
            const completedLessons = Array.isArray(enrollment.completedLessons) 
              ? enrollment.completedLessons.length 
              : 0;
            
            // Calculate progress percentage
            const progress = totalLessons > 0
              ? Math.round((completedLessons / totalLessons) * 100)
              : 0;
              
            return progress >= 50; // Include courses with at least 50% progress for testing
          } catch (err) {
            return false;
          }
        })
        .map(enrollment => ({
          courseId: enrollment.course._id,
          courseTitle: enrollment.course.title,
          studentName: req.user.name,
          completedDate: enrollment.purchased_at,
          thumbnail: enrollment.course.thumbnail || '/api/placeholder/320/180'
        }));
      
      return res.status(200).json({
        success: true,
        data: {
          certificates: partiallyCompletedCourses,
          message: "Showing partially completed courses since no fully completed courses were found."
        }
      });
    }
    
    return res.status(200).json({
      success: true,
      data: {
        certificates: completedCourses
      }
    });
  } catch (error) {
    console.error('Certificates fetch error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch certificates',
      error: error.message
    });
  }
});

// Modify the existing enrollment check route in user.js
router.get('/enrollment/check/:courseId', authMiddleware.checkAuth, async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const userId = req.user._id;

    const existingEnrollment = await studentCourse.findOne({
      student: userId,
      course: courseId
    }).populate('course');

    // If no enrollment found, return not enrolled
    if (!existingEnrollment) {
      return res.status(200).json({
        isEnrolled: false,
        enrollment: null
      });
    }

    // Check if course has validity period and it's expired
    let isExpired = false;
    let expiryDate = null;
    let daysRemaining = null;

    // If the enrollment has an expiresAt date
    if (existingEnrollment.expiresAt) {
      const now = new Date();
      isExpired = now > new Date(existingEnrollment.expiresAt);
      expiryDate = existingEnrollment.expiresAt;
      
      // Calculate days remaining if not expired
      if (!isExpired) {
        const diffTime = Math.abs(new Date(existingEnrollment.expiresAt) - now);
        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
    }

    // Also update isExpired field in database if needed
    if (isExpired !== existingEnrollment.isExpired) {
      existingEnrollment.isExpired = isExpired;
      await existingEnrollment.save();
    }

    res.status(200).json({
      isEnrolled: true,
      isExpired: isExpired,
      enrollment: {
        id: existingEnrollment._id,
        courseId: existingEnrollment.course._id,
        enrolledAt: existingEnrollment.purchased_at,
        expiresAt: expiryDate,
        daysRemaining: daysRemaining
      }
    });

  } catch (error) {
    console.error('Enrollment check error:', error);
    res.status(500).json({ 
      msg: 'Internal server error',
      error: error.message 
    });
  }
});

// routes/courseRoutes.js or wherever you define your routes

router.post('/update-course-access', authMiddleware.checkAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const { courseId } = req.body;

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: 'Course ID is required'
      });
    }

    // Find the student's enrollment for this course
    const enrollment = await studentCourse.findOne({
      student: userId,
      course: courseId
    });

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found'
      });
    }

    // Update the recent_access timestamp
    enrollment.recent_access = new Date();
    await enrollment.save();

    return res.status(200).json({
      success: true,
      message: 'Recent access timestamp updated successfully'
    });
  } catch (error) {
    console.error('Update course access error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});
router.get('/recent-course', authMiddleware.checkAuth, async (req, res) => {
  try {
    const userId = req.user._id;

    // Find the most recently accessed course enrollment record
    const recentEnrollment = await studentCourse.findOne({ student: userId })
      .sort({ recent_access: -1 })
      .populate({
        path: 'course',
        populate: [
          {
            path: 'chapters',
            populate: {
              path: 'lessons'
            }
          },
          {
            path: 'instructor'
          }
        ]
      });

    if (!recentEnrollment || !recentEnrollment.course) {
      return res.status(404).json({
        success: false,
        message: 'No recently accessed course found'
      });
    }

    const course = recentEnrollment.course;

    // Calculate total lessons across all chapters
    let totalLessons = 0;
    course.chapters.forEach(chapter => {
      totalLessons += chapter.lessons.length;
    });

    // Count completed lessons from the enrollment record
    const completedLessons = recentEnrollment.completedLessons.length;
    // Get instructor name or use a fallback
    const instructorName = course.instructor?.name || 'Unknown Instructor';
    // Calculate progress percentage
    const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    // Format the course data similar to the enrolled courses endpoint
    const formattedCourse = {
      id: recentEnrollment._id,
      courseId: course._id,
      title: course.title,
      instructor: instructorName,
      thumbnail: course.thumbnail || '/api/placeholder/320/180',
      description: course.description,
      enrolledAt: recentEnrollment.purchased_at,
      progress: progress,
      completedModules: completedLessons,
      totalModules: totalLessons,
      isCompleted: progress === 100,
      rating: course.rating || 0,
      duration: course.duration || "Not specified"
    };

    return res.status(200).json({
      success: true,
      course: formattedCourse
    });
  } catch (error) {
    console.error('Fetch recent course error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

router.get('/course/:courseId/enrollment-count', authMiddleware.checkAuth, async (req, res) => {
  try {
    const { courseId } = req.params;

    const studentCount = await studentCourse.countDocuments({ course: courseId });

    return res.status(200).json({
      success: true,
      courseId,
      studentCount
    });
  } catch (error) {
    console.error('Error fetching enrollment count:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});


router.get('/certificate/:courseId', authMiddleware.checkAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const { courseId } = req.params;

    // Fetch course details
    const course = await Course.findById(courseId)
    .populate('instructor', 'name')
    .select('title instructor');

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    // Fetch enrollment details to get enrollment date
    const enrollment = await studentCourse.findOne({
      student: userId,
      course: courseId
    });

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found',
      });
    }

    // Format the enrollment date
    const enrollmentDate = new Date(enrollment.purchased_at);
    const formattedDate = enrollmentDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Prepare certificate data
    const certificateData = {
      courseTitle: course.title || 'Course Title',
      studentName: req.user.name || 'Student Name',
      completionDate: formattedDate,
      instructorName: course.instructor?.name || 'Course Instructor' // Add instructor name
    };

    res.status(200).json({
      success: true,
      certificateData,
    });
  } catch (error) {
    console.error('Certificate retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
});
// Revenue Over Time endpoint
// router.get('/revenue-over-time', async (req, res) => {
//   try {
//     const courses = await Course.find({ instructor: req.instructorId });
//     const courseIds = courses.map(c => c._id);
    
//     const enrollments = await StudentCourse.aggregate([
//       { $match: { course: { $in: courseIds } } },
//       {
//         $lookup: {
//           from: 'courses',
//           localField: 'course',
//           foreignField: '_id',
//           as: 'course'
//         }
//       },
//       { $unwind: '$course' },
//       {
//         $group: {
//           _id: { $month: "$purchased_at" },
//           revenue: { $sum: "$course.price" },
//           count: { $sum: 1 }
//         }
//       },
//       {
//         $project: {
//           month: {
//             $arrayElemAt: [
//               ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
//               { $subtract: ["$_id", 1] }
//             ]
//           },
//           revenue: 1,
//           _id: 0
//         }
//       }
//     ]);

//     res.json(enrollments);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// });


router.post('/logout', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ msg: 'Token is required for logout' });
    }

    const success = await logout(token);
    if (!success) {
      return res.status(400).json({ msg: 'Logout failed, session not found' });
    }

    res.json({ msg: 'Logout successful' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Internal server error' });
  }
});

export default router;