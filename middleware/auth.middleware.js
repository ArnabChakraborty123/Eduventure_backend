// middleware/authMiddleware.js
import express from 'express';
import { SessionModel } from '../models/session.models.js';
import { UserModel } from '../models/user.models.js';

const app = express();
app.use(express.json());

class AuthMiddleware {
    constructor(redirectPath = '/logout') {
        this.redirectPath = redirectPath;
        this.checkAuth = this.checkAuth.bind(this);
    }

    async checkAuth(req, res, next) {
        
        try {
            const authHeader = req.headers['authorization'];
            if (!authHeader) {
                console.log("Authorization header missing");
                return res.redirect(this.redirectPath);
            }
            const session = await SessionModel.findOne({ token:authHeader }).populate('userId');
            if (!session) {
                console.log("Session not found for token:", token);
                // Instead of just logging, you might want to return an error response:
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }
            

             req.user = session.userId; 
            next();
        } catch (error) {
            console.error("Authentication error:", error);
            res.status(500).json({ msg: 'Internal server error' });
        }
    }
}

export default AuthMiddleware;
