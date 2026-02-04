import express from "express";
import Cart from "../models/cart.models.js"; // Import the Cart model
import AuthMiddleware from "../middleware/auth.middleware.js";

const router = express.Router();
const authMiddleware = new AuthMiddleware("/logout");

// ✅ Route to Add Course to Cart
router.post("/add", authMiddleware.checkAuth, async (req, res) => {
  try {
    const { courseId } = req.body;
    const userId = req.user._id;

    if (!courseId) {
      return res.status(400).json({ msg: "Course ID is required" });
    }

    let cart = await Cart.findOne({ user: userId });

    if (!cart) {
      // Create new cart if it doesn't exist
      cart = new Cart({ user: userId, items: [{ course: courseId }] });
    } else {
      // Check if course already exists in cart
      const courseExists = cart.items.some((item) => item.course.equals(courseId));

      if (courseExists) {
        return res.status(400).json({ msg: "Course already in cart" });
      }

      // Add course to cart
      cart.items.push({ course: courseId });
    }

    await cart.save();
    res.status(200).json({ msg: "Course added to cart successfully", cart });

  } catch (error) {
    console.error("Add to cart error:", error);
    res.status(500).json({ msg: "Internal server error" });
  }
});

// ✅ Route to Get Cart Details
router.get("/details", authMiddleware.checkAuth, async (req, res) => {
  try {
    const userId = req.user._id;

    const cart = await Cart.findOne({ user: userId })
      .populate({
        path: "items.course",
        select: "title instructor thumbnail description price level category"
      });

    if (!cart || cart.items.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          totalItems: 0,
          cartItems: [],
        },
      });
    }

    // Filter out items where course is null before mapping
    const validCartItems = cart.items.filter(item => item.course !== null);
    
    const formattedCartItems = validCartItems.map((item) => ({
      courseId: item.course._id,
      _id: item.course._id,
      title: item.course.title,
      instructor: item.course.instructor,
      thumbnail: item.course.thumbnail || "/api/placeholder/320/180",
      description: item.course.description,
      price: item.course.price,
      level: item.course.level,
      category: item.course.category,
      addedAt: item.addedAt,
    }));

    res.status(200).json({
      success: true,
      data: {
        totalItems: formattedCartItems.length,
        cartItems: formattedCartItems,
      },
    });

  } catch (error) {
    console.error("Cart details error:", error);
    res.status(500).json({ msg: "Internal server error" });
  }
});

// ✅ Route to Remove Course from Cart
router.delete("/remove/:courseId", authMiddleware.checkAuth, async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user._id;

    const cart = await Cart.findOne({ user: userId });

    if (!cart) {
      return res.status(404).json({ msg: "Cart not found" });
    }

    // Remove course from cart items
    cart.items = cart.items.filter(item => !item.course.equals(courseId));
    
    await cart.save();
    res.status(200).json({ msg: "Course removed from cart successfully", cart });

  } catch (error) {
    console.error("Remove from cart error:", error);
    res.status(500).json({ msg: "Internal server error" });
  }
});

// ✅ Route to Clear Cart
router.delete("/clear", authMiddleware.checkAuth, async (req, res) => {
  try {
    const userId = req.user._id;

    const cart = await Cart.findOne({ user: userId });

    if (!cart) {
      return res.status(404).json({ msg: "Cart not found" });
    }

    // Clear all items from cart
    cart.items = [];
    
    await cart.save();
    res.status(200).json({ msg: "Cart cleared successfully" });

  } catch (error) {
    console.error("Clear cart error:", error);
    res.status(500).json({ msg: "Internal server error" });
  }
});

export default router;