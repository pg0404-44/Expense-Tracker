const express = require("express");
const router = express.Router();

const Expense = require("../models/expense");
const { isLoggedIn } = require("../middlewares/auth.middleware");

// GET all expenses (USER ONLY)
router.get("/", isLoggedIn, async (req, res) => {
    const expenses = await Expense.find({ owner: req.user._id });
    res.json(expenses);
});

module.exports = router;