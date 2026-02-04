import express from 'express';
import Review from '../models/review.models.js';
import AuthMiddleware from '../middleware/auth.middleware.js';

const router = express.Router();
const authMiddleware = new AuthMiddleware('/logout');

// Submit a new review with comment
router.post('/submit', authMiddleware.checkAuth, async (req, res) => {
  try {
    const { courseId, stars, comment } = req.body;
    const userId = req.user.id; // Assuming authentication middleware attaches `user` object

    if (!courseId || !stars || !comment) {
      return res.status(400).json({ 
        success: false, 
        message: 'Course ID, stars rating, and comment are required' 
      });
    }

    let review = await Review.findOne({ courseId });

    if (!review) {
      review = new Review({ courseId, reviews: [] });
    }

    // Check if user has already reviewed
    const existingReview = review.reviews.find(r => r.userId.equals(userId));
    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: "You have already submitted a review for this course."
      });
    }

    // Add new review entry
    review.reviews.push({ userId, stars, comment });
    await review.save();

    return res.status(200).json({
      success: true,
      message: 'Review submitted successfully'
    });
  } catch (error) {
    console.error('Submit review error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get all reviews for a specific course
router.get('/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params;
    const review = await Review.findOne({ courseId }).populate("reviews.userId", "name"); // Populate user name

    return res.status(200).json({
      success: true,
      data: review ? review.reviews : []
    });
  } catch (error) {
    console.error('Get review error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

export default router;
