// notificationRoutes.js
import express from 'express';
import Notification from '../models/notification.models.js';
// import { authenticateInstructor } from '../middleware/authMiddleware.js';

const router = express.Router();

// POST route for instructors to create notifications for all their students
router.post('/', async (req, res) => {
    try {
      const { instructorId, title, message } = req.body;
      
      if (!instructorId || !title || !message) {
        return res.status(400).json({ 
          success: false, 
          message: 'InstructorId, title and message are required' 
        });
      }
  
      const notification = new Notification({
        instructorId, // Use the instructorId directly from the request body
        title,
        message
      });
  
      await notification.save();
  
      res.status(201).json({
        success: true,
        message: 'Notification created successfully',
        notification
      });
    } catch (error) {
      console.error('Error creating notification:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Server error while creating notification' 
      });
    }
  });

// GET route for students to see notifications from their instructors
router.get('/', async (req, res) => {
  try {
    // Calculate the date 2 days ago
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    
    const notifications = await Notification.find({
      createdAt: { $gte: twoDaysAgo } // Only return notifications from the last 2 days
    })
      .sort({ createdAt: -1 }) // Sort by most recent first
      .lean();
    
    res.status(200).json({
      success: true,
      notifications
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching notifications' 
    });
  }
});

// GET route for a single notification
router.get('/notifications/:id', async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id)
      .populate('instructorId');
    
    if (!notification) {
      return res.status(404).json({ 
        success: false, 
        message: 'Notification not found' 
      });
    }
    
    res.status(200).json({
      success: true,
      notification
    });
  } catch (error) {
    console.error('Error fetching notification:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching notification' 
    });
  }
});

// DELETE route to remove a notification
router.delete('/:id', async (req, res) => {
  try {
    const notification = await Notification.findByIdAndDelete(req.params.id);

    if (!notification) {
      return res.status(404).json({ 
        success: false, 
        message: 'Notification not found' 
      });
    }

    res.status(200).json({ 
      success: true, 
      message: 'Notification deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while deleting notification' 
    });
  }
});

export default router;