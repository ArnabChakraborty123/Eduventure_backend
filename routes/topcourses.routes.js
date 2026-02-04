import express from 'express';
import Course from '../models/course.models.js';
import Review from '../models/review.models.js';
import studentCourse from '../models/studentCourse.model.js';
import mongoose from 'mongoose';

const router = express.Router();

/**
 * GET /api/topcourses
 * Returns the top rated courses based on review scores
 * Query parameters:
 *   - limit: Number of courses to return (default: 3)
 */
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 3;
    
    // Aggregate to find top rated courses
    const topRatedCourses = await Review.aggregate([
      // Unwind the reviews array to work with individual reviews
      { $unwind: '$reviews' },
      
      // Group by courseId and calculate average stars
      { 
        $group: {
          _id: '$courseId',
          averageRating: { $avg: '$reviews.stars' },
          reviewCount: { $sum: 1 }
        } 
      },
      
      // Sort by average rating in descending order
      { $sort: { averageRating: -1 } },
      
      // Limit to requested number of courses
      { $limit: limit },
      
      // Lookup course details
      {
        $lookup: {
          from: 'courses',
          localField: '_id',
          foreignField: '_id',
          as: 'courseDetails'
        }
      },
      
      // Unwind the courseDetails array
      { $unwind: '$courseDetails' },
      
      
      
      
      // Count enrolled students
      {
        $lookup: {
          from: 'studentcourses',
          localField: '_id',
          foreignField: 'courseId',
          as: 'enrollments'
        }
      },
      
      // Project the final shape of the data
      {
        $project: {
          _id: '$courseDetails._id',
          title: '$courseDetails.title',
          description: '$courseDetails.description',
          thumbnail: '$courseDetails.thumbnail',
          price: '$courseDetails.price',
          category: '$courseDetails.category',
          level: '$courseDetails.level',
          rating: '$averageRating',
          reviewCount: '$reviewCount',
        //   studentCount: { $size: '$enrollments' }
        }
      }
    ]);

    // If no courses found with reviews, get newest courses instead
    if (topRatedCourses.length === 0) {
      const newestCourses = await Course.find({ visibility: 'public' })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('instructor', 'name avatar');
      
      const coursesWithCounts = await Promise.all(newestCourses.map(async (course) => {
        const studentCount = await studentCourse.countDocuments({ courseId: course._id });
        return {
          ...course.toObject(),
          studentCount,
          rating: 0,
          reviewCount: 0
        };
      }));
      
      return res.status(200).json(coursesWithCounts);
    }

    res.status(200).json(topRatedCourses);
  } catch (error) {
    console.error('Error fetching top courses:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;