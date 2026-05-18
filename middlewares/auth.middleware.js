const Expense = require("../models/expense");

module.exports.isLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) {
        return res.redirect("/login");
    }
    next();
};

module.exports.isOwner = async (req, res, next) => {
    let { id } = req.params;
    const expense = await Expense.findById(id);

    if (!expense.owner.equals(req.user._id)) {
        req.flash("error", "You don't have permission");
        return res.redirect("/listexpenses");
    }
    next();
};