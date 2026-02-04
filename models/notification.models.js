import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    instructorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Instructor',
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    // isRead: {
    //   type: Map,
    //   of: Boolean, 
    //   default: {},
    // },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 20,
    },
  },
  { timestamps: true }
);

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification
