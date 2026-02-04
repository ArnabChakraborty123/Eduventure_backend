import studentCourse from '../models/studentCourse.model.js';

export class CourseValidityMiddleware {
  async checkValidity(req, res, next) {
    try {
      const userId = req.user._id;
      const courseId = req.params.courseId || req.body.courseId;
      
      if (!courseId) {
        return next();
      }

      const enrollment = await studentCourse.findOne({
        student: userId,
        course: courseId
      }).populate('course');

      if (!enrollment) {
        // Not enrolled, continue with route
        return next();
      }

      // Check if course has an expiry date
      if (enrollment.expiresAt) {
        const now = new Date();
        const isExpired = now > new Date(enrollment.expiresAt);
        
        // Update the enrollment record if needed
        if (isExpired !== enrollment.isExpired) {
          enrollment.isExpired = isExpired;
          await enrollment.save();
        }

        // Attach enrollment and expiration info to request for route handlers
        req.courseEnrollment = {
          enrollment,
          isExpired
        };
      }

      next();
    } catch (error) {
      console.error('Course validity check error:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Error checking course validity',
        error: error.message
      });
    }
  }
}

export default CourseValidityMiddleware;