import mongoose from 'mongoose';

const ReviewSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true
    },
    reviews: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
          unique: true
        },
        stars: {
          type: Number,
          required: true,
          min: 1,
          max: 5
        },
        comment: { 
          type: String, 
          required: true 
        }
      }
    ]
  },
  { timestamps: true }
);

const Review = mongoose.models.Review || mongoose.model("Review", ReviewSchema);

export default Review;
