import express from 'express';
import FAQ from '../models/faq.models.js';

const router = express.Router();

// GET all active FAQs
router.get('/', async (req, res) => {
  try {
    const faqs = await FAQ.find({ isActive: true }).sort({ order: 1 });
    
    res.status(200).json({
      success: true,
      count: faqs.length,
      data: faqs
    });
  } catch (error) {
    console.error('Error fetching FAQs:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching FAQs' 
    });
  }
});

// POST create a new FAQ (admin/instructor route)
router.post('/', async (req, res) => {
  try {
    const { question, answer,  isActive, order } = req.body;
    
    // Validate required fields
    if (!question || !answer) {
      return res.status(400).json({ 
        success: false, 
        message: 'Question and answer are required' 
      });
    }

    // Check if FAQ with same question already exists
    const existingFAQ = await FAQ.findOne({ question });
    if (existingFAQ) {
      return res.status(400).json({ 
        success: false, 
        message: 'FAQ with this question already exists' 
      });
    }

    const newFAQ = new FAQ({
      question,
      answer,
      isActive: isActive !== undefined ? isActive : true,
      order: order || 0
    });

    await newFAQ.save();

    res.status(201).json({
      success: true,
      message: 'FAQ created successfully',
      data: newFAQ
    });
  } catch (error) {
    console.error('Error creating FAQ:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while creating FAQ' 
    });
  }
});


// DELETE an FAQ
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const faq = await FAQ.findByIdAndDelete(id);
    if (!faq) {
      return res.status(404).json({ 
        success: false, 
        message: 'FAQ not found' 
      });
    }

    res.status(200).json({
      success: true,
      message: 'FAQ deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting FAQ:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while deleting FAQ' 
    });
  }
});

export default router;