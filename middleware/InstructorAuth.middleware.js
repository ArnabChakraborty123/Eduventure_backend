import express from 'express';
import { InstructorSessionModel } from '../models/session.models.js';

const app = express();
app.use(express.json());

export const checkInstructorAuth = async (req, res, next) => {
    try {
        // Check for token in various locations
        const authInstructorHeader = 
            req.headers.authorization || 
            req.headers.instructorauth || 
            req.body.instructorAuth;

        if (!authInstructorHeader) {
            console.log("Instructor Authorization header missing");
            return res.status(401).json({ msg: 'Authentication required' });
        }

        // Use findOne and await it
        const session = await InstructorSessionModel.findOne({ token: authInstructorHeader }).populate('instructorId');

        if (!session) {
            console.log("Session not found for token", authInstructorHeader);
            return res.status(401).json({ msg: 'Invalid session' });
        }

        req.instructor = session.instructorId;
        next();
    } catch (error) {
        console.log("Authentication Error", error);
        return res.status(500).json({ msg: 'Authentication error', error: error.message });
    }
};

export default { checkInstructorAuth };