import express from 'express';
import multer from 'multer';
import path from 'path';
import Course from '../models/course.models.js';
import Lesson from '../models/lesson.models.js';
import Chapter from '../models/chapter.models.js';
import Review from '../models/review.models.js';
import Instructor from '../models/instructor.models.js';
import fs from 'fs-extra';
import { v4 as uuidv4 } from 'uuid';
import AuthMiddleware from '../middleware/auth.middleware.js';
import studentCourse from '../models/studentCourse.model.js';
import { checkInstructorAuth } from '../middleware/InstructorAuth.middleware.js';

const router = express.Router();
const authMiddleware = new AuthMiddleware('/logout');

// Configure storage for uploaded files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${uuidv4()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } 
});

router.post("/create", (req, res, next) => {
  // Define all possible file fields dynamically based on pattern
  const uploadFields = [
    { name: 'thumbnail', maxCount: 1 },
    { name: 'videoPreview', maxCount: 1 }
  ];
  
  // Add fields for videos and documents
  for (let i = 0; i < 10; i++) {  // Support up to 10 chapters
    for (let j = 0; j < 10; j++) {  // Support up to 10 lessons per chapter
      // Video upload fields
      for (let k = 0; k < 5; k++) {  // Support up to 5 videos per lesson
        uploadFields.push({ name: `video_${i}_${j}_${k}`, maxCount: 1 });
      }
      
      // Document upload fields
      for (let k = 0; k < 5; k++) {  // Support up to 5 documents per lesson
        uploadFields.push({ name: `document_${i}_${j}_${k}`, maxCount: 1 });
      }
    }
  }

  const courseUploads = upload.fields(uploadFields);

  courseUploads(req, res, async (err) => {
    if (err) {
      console.error("Upload error:", err);
      return res.status(500).json({ success: false, message: err.message });
    }

    try {
      console.log("Request body:", req.body);
      console.log("Files received:", Object.keys(req.files || {}));
      
      const { 
        title, 
        description, 
        price, 
        category, 
        instructorId, 
        level, 
        requirements, 
        learningOutcomes,
        chaptersData,
        documentsData,
        validityPeriod,
        visibility
      } = req.body;

      const decodedTitle = decodeURIComponent(title);
      console.log("Decoded Title:", decodedTitle);

      // Parse JSON strings
      let parsedRequirements = [];
      let parsedLearningOutcomes = [];
      let parsedChaptersData = [];
      let parsedDocumentsData = [];
      let parsedValidityPeriod = { type: 'none', duration: 0 };

      try {
        parsedRequirements = requirements ? JSON.parse(requirements) : [];
        parsedLearningOutcomes = learningOutcomes ? JSON.parse(learningOutcomes) : [];
        parsedChaptersData = chaptersData ? JSON.parse(chaptersData) : [];
        parsedDocumentsData = documentsData ? JSON.parse(documentsData) : [];
        
        // Parse the validity period JSON
        if (validityPeriod) {
          parsedValidityPeriod = JSON.parse(validityPeriod);
        }
      } catch (parseError) {
        console.error("JSON parsing error:", parseError);
        return res.status(400).json({ error: "Invalid JSON data" });
      }

      // Fetch the instructor to get the name
      const instructor = await Instructor.findById(instructorId);
      if (!instructor) {
        return res.status(404).json({ error: "Instructor not found" });
      }

      // Create the course first
      const courseData = {
        title: decodedTitle,
        description,
        price: parseFloat(price),
        category,
        level: level || 'beginner',
        requirements: parsedRequirements,
        learningOutcomes: parsedLearningOutcomes,
        instructor: instructorId,
        instructorName: instructor.name,
        chapters: [],
        validityPeriod: parsedValidityPeriod,
        visibility: visibility || 'public'
      };

      if (req.files?.thumbnail) {
        courseData.thumbnail = `/uploads/${req.files.thumbnail[0].filename}`;
      }
      
      if (req.files?.videoPreview) {
        const previewFile = req.files.videoPreview[0];
        courseData.videoPreview = `/uploads/${previewFile.filename}`;
        
        // Add video metadata if needed
        try {
          const stats = await fs.stat(`public/uploads/${previewFile.filename}`);
          courseData.previewVideoSize = stats.size;
        } catch (err) {
          console.error("Error getting preview video stats:", err);
        }
      }

      // Create and save the course
      const newCourse = new Course(courseData);
      const savedCourse = await newCourse.save();
      console.log(`Created course with ID: ${savedCourse._id}`);
      
      // Process chapters and lessons
      const chapterPromises = parsedChaptersData.map(async (chapterData, chapterIndex) => {
        // Create a new chapter
        const newChapter = new Chapter({
          title: chapterData.title,
          course: savedCourse._id,
          lessons: []
        });
        
        const savedChapter = await newChapter.save();
        
        // Process lessons for this chapter
        const lessonPromises = chapterData.lessons.map(async (lessonData, lessonIndex) => {
          // Create a new lesson linked to this chapter
          const newLesson = new Lesson({
            title: lessonData.title,
            content: lessonData.content,
            chapter: savedChapter._id,
            videos: [],
            documents: []
          });
          
          // Save lesson first to get ID
          const savedLesson = await newLesson.save();
          
          // Process videos for this lesson
          const videoPromises = lessonData.videos.map(async (videoData, videoIndex) => {
            const videoFieldName = `video_${chapterIndex}_${lessonIndex}_${videoIndex}`;
            
            if (req.files && req.files[videoFieldName]) {
              const videoFile = req.files[videoFieldName][0];
              const videoPath = `/public/uploads/${videoFile.filename}`;
              
              // Add video to the lesson's videos array
              savedLesson.videos.push({
                title: videoData.title,
                url: videoPath,
                duration: 0, // You might want to extract this using a lightweight method if needed
                size: videoFile.size
              });
            }
          });
          
          // Process documents for this lesson
          const documentPromises = parsedDocumentsData[chapterIndex]?.[lessonIndex]?.map(async (documentData, documentIndex) => {
            const documentFieldName = `document_${chapterIndex}_${lessonIndex}_${documentIndex}`;
            
            if (req.files && req.files[documentFieldName]) {
              const documentFile = req.files[documentFieldName][0];
              const documentPath = `/uploads/${documentFile.filename}`;
              
              // Add document to the lesson's documents array
              savedLesson.documents.push({
                title: documentData.title || documentFile.originalname,
                url: documentPath,
                fileType: documentFile.mimetype,
                size: documentFile.size
              });
            }
          }) || [];
          
          // Wait for all video and document processing
          await Promise.all([...videoPromises, ...documentPromises]);
            
          // Save the lesson again with its videos and documents
          await savedLesson.save();
          
          // Add lesson ID to chapter's lessons array
          savedChapter.lessons.push(savedLesson._id);
          
          return savedLesson._id;
        });
        
        const lessonIds = await Promise.all(lessonPromises);
        
        // Update chapter with lesson IDs
        await savedChapter.save();
        
        // Add chapter ID to course's chapters array
        return savedChapter._id;
      });
      
      const chapterIds = await Promise.all(chapterPromises);
      
      // Update course with chapter IDs
      savedCourse.chapters = chapterIds;
      await savedCourse.save();

      await Instructor.findByIdAndUpdate(
        instructorId,
        { $push: { courses: savedCourse._id } }
      );
      
      res.status(201).json({ 
        message: "Course created successfully.", 
        course: savedCourse 
      });
    } catch (error) {
      console.error("Course creation error:", error);
      res.status(500).json({ error: error.message });
    }
  });
});


// UPDATE COURSE ENDPOINT
router.put("/:id", (req, res, next) => {
  const uploadFields = [
    { name: 'thumbnail', maxCount: 1 },
    { name: 'videoPreview', maxCount: 1 },
    { name: 'lessonVideos', maxCount: 10 } 
  ];

  const courseUploads = upload.fields(uploadFields);

  courseUploads(req, res, async (err) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }

    try {
      const { id } = req.params;
      const { 
        title, 
        description, 
        price, 
        category, 
        level, 
        requirements, 
        learningOutcomes, 
        chaptersData,
        validityType,
        validityDuration,
        visibility
      } = req.body;

      // First, check if the course exists
      const existingCourse = await Course.findById(id);
      if (!existingCourse) {
        return res.status(404).json({ success: false, message: "Course not found" });
      }

      // Update course basic details
      const courseUpdateData = {
        title,
        description,
        price: parseFloat(price),
        category,
        level: level || 'beginner',
        requirements: requirements ? JSON.parse(requirements) : existingCourse.requirements,
        learningOutcomes: learningOutcomes ? JSON.parse(learningOutcomes) : existingCourse.learningOutcomes,
        validityPeriod: {
          type: validityType || existingCourse.validityPeriod?.type || 'none',
          duration: validityDuration ? parseInt(validityDuration, 10) : existingCourse.validityPeriod?.duration || 0
        },
        visibility: visibility || existingCourse.visibility || 'public'
      };

      // Update thumbnail if provided
      if (req.files?.thumbnail) {
        courseUpdateData.thumbnail = `/uploads/${req.files.thumbnail[0].filename}`;
      }
      
      // Update preview video if provided
      if (req.files?.videoPreview) {
        const previewFile = req.files.videoPreview[0];
        courseUpdateData.videoPreview = `/uploads/${previewFile.filename}`;
        
        // Add video metadata if needed
        try {
          const stats = await fs.stat(`public/uploads/${previewFile.filename}`);
          courseUpdateData.previewVideoSize = stats.size;
        } catch (err) {
          console.error("Error getting preview video stats:", err);
        }
      }

      // Update the course document
      const updatedCourse = await Course.findByIdAndUpdate(
        id,
        courseUpdateData,
        { new: true, runValidators: true }
      );

      // Handle chapters and lessons updates
      if (chaptersData) {
        const parsedChaptersData = JSON.parse(chaptersData);
        const existingChapters = await Chapter.find({ course: id }).populate('lessons');
        const uploadedLessonVideos = req.files?.lessonVideos || [];
        let videoIndex = 0;
        
        // Create a map of existing chapters and lessons for easier lookup
        const existingChaptersMap = {};
        existingChapters.forEach(chapter => {
          existingChaptersMap[chapter._id.toString()] = chapter;
        });

        const updatedChapterIds = [];
        
        // Process each chapter from the request
        for (const chapterData of parsedChaptersData) {
          let chapter;
          
          if (chapterData._id) {
            // Update existing chapter
            chapter = await Chapter.findByIdAndUpdate(
              chapterData._id,
              { title: chapterData.title },
              { new: true }
            );
          } else {
            // Create new chapter
            chapter = new Chapter({
              title: chapterData.title,
              course: id,
              lessons: []
            });
            await chapter.save();
          }
          
          updatedChapterIds.push(chapter._id);
          
          // Process lessons for this chapter
          if (chapterData.lessons && chapterData.lessons.length > 0) {
            const updatedLessonIds = [];
            
            for (const lessonData of chapterData.lessons) {
              let lesson;
              
              if (lessonData._id) {
                // Update existing lesson
                const lessonUpdateData = {
                  title: lessonData.title,
                  content: lessonData.content,
                  chapter: chapter._id
                };
                
                lesson = await Lesson.findByIdAndUpdate(
                  lessonData._id,
                  lessonUpdateData,
                  { new: true }
                );

                // Handle video deletion flag
                if (lessonData.deleteExistingVideo) {
                  // Clear all videos from this lesson
                  lesson.videos = [];
                  await lesson.save();
                }
              } else {
                // Create new lesson
                lesson = new Lesson({
                  title: lessonData.title,
                  content: lessonData.content,
                  chapter: chapter._id,
                  videos: []
                });
                await lesson.save();
              }
              
              updatedLessonIds.push(lesson._id);
              
              // Handle video uploads for this lesson
              if (lessonData.hasNewVideo && videoIndex < uploadedLessonVideos.length) {
                const videoFile = uploadedLessonVideos[videoIndex];
                const videoPath = `/uploads/${videoFile.filename}`;
                
                // Replace existing videos with the new one
                lesson.videos = [{
                  title: lessonData.videoTitle || `Video for ${lesson.title}`,
                  url: videoPath,
                  duration: 0, // You might want to extract this if needed
                  size: videoFile.size || 0
                }];
                
                await lesson.save();
                videoIndex++;
              }
            }
            
            // Update chapter with the current lessons
            chapter.lessons = updatedLessonIds;
            await chapter.save();
            
            // Remove lessons that are no longer associated with this chapter
            if (existingChaptersMap[chapter._id.toString()]) {
              const existingLessons = existingChaptersMap[chapter._id.toString()].lessons;
              
              for (const existingLesson of existingLessons) {
                if (!updatedLessonIds.some(id => id.toString() === existingLesson._id.toString())) {
                  await Lesson.findByIdAndDelete(existingLesson._id);
                }
              }
            }
          }
        }
        
        // Update course with the current chapters
        updatedCourse.chapters = updatedChapterIds;
        await updatedCourse.save();
        
        // Remove chapters that are no longer associated with this course
        for (const existingChapter of existingChapters) {
          if (!updatedChapterIds.some(id => id.toString() === existingChapter._id.toString())) {
            // Delete associated lessons first
            for (const lessonId of existingChapter.lessons) {
              await Lesson.findByIdAndDelete(lessonId);
            }
            // Then delete the chapter
            await Chapter.findByIdAndDelete(existingChapter._id);
          }
        }
      }

      res.status(200).json({
        success: true,
        message: "Course updated successfully.",
        course: updatedCourse
      });
    } catch (error) {
      console.error("Course update error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

// Get all chapters for a course
router.get("/:id/chapters", async (req, res) => {
  try {
    const chapters = await Chapter.find({ course: req.params.id })
      .populate('lessons')
      .sort({ createdAt: 1 }); // Sort by creation date
    
    res.status(200).json(chapters);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a course with its chapters and lessons for editing
router.get("/:id/edit", async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    
    const chapters = await Chapter.find({ course: req.params.id })
      .populate('lessons')
      .sort({ createdAt: 1 });
    
    res.status(200).json({
      course,
      chapters
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get processing status for a lesson
router.get("/lesson/:id/processing-status", async (req, res) => {
  try {
    const lessonId = req.params.id;
    const job = await videoQueue.getJob(`lesson-${lessonId}`);
    
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }
    
    const state = await job.getState();
    const progress = job.progress || 0;
    
    res.status(200).json({ 
      lessonId,
      state,
      progress,
      completed: state === 'completed'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/lessons/:lessonId/complete", authMiddleware.checkAuth, async (req, res) => {
  try {
    const { lessonId } = req.params;
    const userId = req.user._id;
    const { courseId } = req.body; // Get courseId from request body

    if (!courseId) {
      return res.status(400).json({ message: "Course ID is required" });
    }

    console.log(`User ${userId} marking lesson ${lessonId} as complete for course ${courseId}`);

    // Find the student course record
    let studentCourseRecord = await studentCourse.findOne({
      student: userId,
      course: courseId
    });

    if (!studentCourseRecord) {
      return res.status(404).json({ message: "Student course record not found" });
    }

    // Check if the lesson is already completed
    const lessonAlreadyCompleted = studentCourseRecord.completedLessons.some(
      item => item.lesson.toString() === lessonId
    );

    if (!lessonAlreadyCompleted) {
      // Add the completed lesson to the array
      studentCourseRecord.completedLessons.push({
        lesson: lessonId,
        completed_at: new Date()
      });

      // Update the recent access timestamp
      studentCourseRecord.recent_access = new Date();

      // Save the updated record
      await studentCourseRecord.save();
    }

    return res.status(200).json({ 
      success: true, 
      message: "Lesson marked as complete",
      completedLessons: studentCourseRecord.completedLessons
    });
  } catch (error) {
    console.error("Error marking lesson as complete:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

/**
 * Route to update lesson completion status
 * PUT /api/courses/lessons/:lessonId/complete
 */
router.put("/lessons/:lessonId/complete", authMiddleware.checkAuth, async (req, res) => {
  try {
    const { lessonId } = req.params;
    const userId = req.user._id;
    const { courseId, completed } = req.body;

    if (!courseId) {
      return res.status(400).json({ message: "Course ID is required" });
    }

    console.log(`User ${userId} updating lesson ${lessonId} completion status to ${completed} for course ${courseId}`);

    // Find the student course record
    let studentCourseRecord = await studentCourse.findOne({
      student: userId,
      course: courseId
    });

    if (!studentCourseRecord) {
      return res.status(404).json({ message: "Student course record not found" });
    }

    if (completed) {
      // Add the lesson to completed if not already there
      const lessonAlreadyCompleted = studentCourseRecord.completedLessons.some(
        item => item.lesson.toString() === lessonId
      );

      if (!lessonAlreadyCompleted) {
        studentCourseRecord.completedLessons.push({
          lesson: lessonId,
          completed_at: new Date()
        });
      }
    } else {
      // Remove the lesson from completed lessons
      studentCourseRecord.completedLessons = studentCourseRecord.completedLessons.filter(
        item => item.lesson.toString() !== lessonId
      );
    }

    // Update the recent access timestamp
    studentCourseRecord.recent_access = new Date();

    // Save the updated record
    await studentCourseRecord.save();

    return res.status(200).json({ 
      success: true, 
      message: completed ? "Lesson marked as complete" : "Lesson marked as incomplete",
      completedLessons: studentCourseRecord.completedLessons
    });
  } catch (error) {
    console.error("Error updating lesson completion status:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});


 

// Get all courses
router.get("/", async (req, res) => {
  try {
    const courses = await Course.find()
    .sort({createdAt: -1});
    res.status(200).json(courses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get course by ID
router.get("/:id", async (req, res) => {
  try {
    const course = await Course.findById(req.params.id).populate('instructor', 'name');
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    res.status(200).json(course);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Get lessons for a specific course
router.get("/:id/lessons", authMiddleware.checkAuth, async (req, res) => {
  try {
    const courseId = req.params.id;
    const userId = req.user._id;

    // First find all chapters for this course
    const chapters = await Chapter.find({ course: req.params.id });
    
    if (!chapters || chapters.length === 0) {
      return res.status(200).json([]);
    }
    
    // Get all chapter IDs
    const chapterIds = chapters.map(chapter => chapter._id);
    
    // Find all lessons that belong to any of these chapters
    const lessons = await Lesson.find({ chapter: { $in: chapterIds } });
    
    // Check if the user is enrolled and has completion data
    const studentCourseRecord = await studentCourse.findOne({
      student: userId,
      course: courseId
    });
    
    if (studentCourseRecord && studentCourseRecord.completedLessons) {
      const completedLessonIds = studentCourseRecord.completedLessons.map(item => 
        item.lesson.toString()
      );
      
      // Add completion status and documents for enrolled users
      return res.status(200).json(lessons.map(lesson => ({
        _id: lesson._id,
        title: lesson.title,
        content: lesson.content,
        videos: lesson.videos,
        documents: lesson.documents, // Include documents here
        chapter: lesson.chapter,
        isCompleted: completedLessonIds.includes(lesson._id.toString())
      })));
    } 
    
    // For non-enrolled users, return lessons with documents
    return res.status(200).json(lessons.map(lesson => ({
      _id: lesson._id,
      title: lesson.title,
      content: lesson.content,
      videos: lesson.videos,
      documents: lesson.documents, // Include documents here
      chapter: lesson.chapter,
      isCompleted: false
    })));

  } catch (error) {
    console.error("Error fetching lessons:", error);
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:id", async(req,res)=> {
  try {
    const { id } = req.params;
    const deletedCourse = await Course.findByIdAndDelete(id);

    if(!deletedCourse){
      return res.status(404).json({ success: false, message: "Course not found" });
    }

    res.status(200).json({ success: true, message: "Course deleted succesfully" })
  } catch (error) {
    res.status(500).json({ success: false, message: "Error deleting course", error: error.message });
  }
});

router.post('/:id/toggle-visibility', async (req, res) => {
  try {
    console.log('Course ID:', req.params.id);  
    const course = await Course.findOne({ _id: req.params.id });   
    if (!course) {
      console.log('Course not found');
      return res.status(404).json({ success: false, message: 'Course not found' });
    }
    console.log('Found course:', JSON.stringify(course, null, 2));
    
    const currentVisibility = course.visibility || 'public';
    console.log('Current visibility:', currentVisibility);
    
    const newVisibility = currentVisibility === 'public' ? 'private' : 'public';
    console.log('New visibility:', newVisibility);  
    const updatedCourse = await Course.findByIdAndUpdate(
      req.params.id, 
      { visibility: newVisibility }, 
      { new: true, runValidators: true }
    );
    if (!updatedCourse) {
      console.log('Update failed');
      return res.status(500).json({ success: false, message: 'Failed to update course' });
    }
    console.log('Updated course visibility:', updatedCourse.visibility);
    res.json({ success: true, visibility: updatedCourse.visibility });
  } catch (error) {
    console.error('Error toggling visibility:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});
// Add this to your course routes file
// router.get("/instructor-courses", checkInstructorAuth, async (req, res) => {
//   try {
//     // Get the instructor ID from the authenticated request
//     const instructorId = req.instructor._id;
    
//     // Find only courses created by this instructor
//     const courses = await Course.find({ instructor: instructorId })
//       .sort({ createdAt: -1 });
    
//     res.status(200).json(courses);
//   } catch (error) {
//     console.error("Error fetching instructor courses:", error);
//     res.status(500).json({ error: error.message });
//   }
// });
router.get("/instructor/:id", async (req, res) => {
  try {
    const instructorId = req.params.id;
    
    // Find courses by this instructor that are public (or all if you want to show all)
    const courses = await Course.find({ 
      instructor: instructorId,
      // Uncomment the next line if you only want public courses
      // visibility: "public" 
    })
    .sort({ createdAt: -1 })
    .select("_id title description price level category thumbnail visibility createdAt");
    
    res.status(200).json(courses);
  } catch (error) {
    console.error("Error fetching instructor courses:", error);
    res.status(500).json({ error: error.message });
  }
});
export default router;