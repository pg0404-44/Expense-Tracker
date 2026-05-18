require("dotenv").config();
console.log("MONGO_URL:", process.env.MONGO_URL); // should print the URL
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const session = require("express-session");
const passport = require("passport");
// Models
const User = require("./models/user.js");
const Expense = require("./models/expense.js");

// Utils
const wrapAsync = require("./utils/wrapAsync.js");
const ExpressError = require("./utils/ExpressError.js");
const { expenseSchema } = require("./schema.js");
const { isLoggedIn,isOwner} = require("./middlewares/auth.middleware");
const flash = require("connect-flash");
const expenseRoutes = require("./routes/expense.routes");


// then replace hardcoded values:
const Mongourl = process.env.MONGO_URL;

const sessionOptions = {
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
};

// Routers
const userRouter = require("./routes/users.js");
// ─── DB CONNECTION ───────────────────────────────────────────

async function main() {
    await mongoose.connect(Mongourl);
}
main()
    .then(() => console.log("connected DB"))
    .catch((err) => console.log(err));

// ─── APP SETTINGS ────────────────────────────────────────────
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.engine("ejs", ejsMate);

// ─── MIDDLEWARE ──────────────────────────────────────────────
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "/public")));
app.use(methodOverride("_method"));

// ─── SESSION (must be before passport) ──────────────────────

app.use(session(sessionOptions));
app.use(flash());

// ─── PASSPORT (all together, in order) ──────────────────────
app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
    res.locals.currUser = req.user;
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    next();
});
app.use("/api/expenses", expenseRoutes);
passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// ─── ROUTES ──────────────────────────────────────────────────
app.use("/", userRouter);

app.get("/", (req, res) => {
    res.render("expenses/home.ejs");
});;

app.get("/test", (req, res) => {
    console.log(req.user);
    console.log(req.isAuthenticated());
    res.send("test");
});

// Index Route
app.get("/listexpenses",isLoggedIn, async (req, res) => {
    const allExpenses = await Expense.find({ owner: req.user._id });
    res.render("expenses/index.ejs", { allExpenses });
});

// Dashboard
app.get("/dashboard",isLoggedIn,async(req,res)=>{
const categoryData =await Expense.aggregate([
        {$match:{ owner:req.user._id
          }  }, {  $group:{
                _id:"$category",
                totalSpent:{   $sum:"$amount"
                }}}
    ]);
    const monthlyData =
    await Expense.aggregate([
        { $match:{ owner:req.user._id  }
        }, { $group:{ _id:{month:{
                        $month:"$Date" } },
                totalSpent:{  $sum:"$amount" } } },
        { $sort:{ "_id.month":1 } }
    ]);
    res.render("expenses/dashboard.ejs",{ categoryData, monthlyData });
});
// New Route
app.get("/listexpenses/new", isLoggedIn, (req, res) => {
    res.render("expenses/new.ejs");
});

// Validate Expense Middleware
const validateExpense = (req, res, next) => {
    let { error } = expenseSchema.validate(req.body);
    if (error) {
        let errMsg = error.details.map((el) => el.message).join(",");
        throw new ExpressError(400, errMsg);
    } else {
        next();
    }
};

// Create Route
app.post(
    "/listexpenses",
    isLoggedIn,
    validateExpense,
    wrapAsync(async (req, res, next) => {
        const newExpense = new Expense(req.body.expense);
        newExpense.owner = req.user._id;
        await newExpense.save();
        req.flash("success","Expense Added Successfully");
        res.redirect("/listexpenses");
    })
);

// Show Route
app.get(
    "/listexpenses/:id",isLoggedIn,isOwner,
    wrapAsync(async (req, res) => {
        let { id } = req.params;
        const expenses = await Expense.findById(id);
        res.render("expenses/show.ejs", { expenses });
    })
);

// Edit Route
app.get(
    "/listexpenses/:id/edit",
    isLoggedIn,isOwner,
    wrapAsync(async (req, res) => {
        let { id } = req.params;
        const expenses = await Expense.findById(id);
        res.render("expenses/edit.ejs", { expenses });
    })
);

// Update Route
app.put(
    "/listexpenses/:id",
  isLoggedIn,isOwner,
    validateExpense,
    wrapAsync(async (req, res) => {
        let { id } = req.params;
        await Expense.findByIdAndUpdate(id, { ...req.body.expense });
        req.flash("success","Expense Updated Successfully");
        res.redirect(`/listexpenses/${id}`);
    })
);

// Delete Route
app.delete(
    "/listexpenses/:id",
   isLoggedIn,isOwner,
    wrapAsync(async (req, res) => {
        let { id } = req.params;
        const deleteExpense = await Expense.findByIdAndDelete(id);
        console.log(deleteExpense);
        req.flash("success","Expense Deleted Successfully");
        res.redirect("/listexpenses");
    })
);
// Category Filter
app.get("/expenses/filter", isLoggedIn, async (req, res) => {
    const { category, min, max, startDate, endDate, keyword } = req.query;
    let filter = { owner: req.user._id };

    if (keyword) {
        filter.$or = [
            { title: { $regex: keyword, $options: "i" } },
            { category: { $regex: keyword, $options: "i" } },
            { note: { $regex: keyword, $options: "i" } }
        ];
    }
    if (category) filter.category = category;
    if (min || max) {
        filter.amount = {};
        if (min) filter.amount.$gte = Number(min);
        if (max) filter.amount.$lte = Number(max);
    }
    if (startDate || endDate) {
        filter.Date = {};
        if (startDate) filter.Date.$gte = new Date(startDate);
        if (endDate) filter.Date.$lte = new Date(endDate);
    }

    const allExpenses = await Expense.find(filter);
    res.render("expenses/index.ejs", { allExpenses });
});
// Recent Expenses
app.get(
    "/expenses/recent",isLoggedIn,
    wrapAsync(async (req, res) => {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        let filter = {
    owner:req.user._id
};
        const expenses = await Expense.find({
    owner:req.user._id, Date:{  $gte: sevenDaysAgo }
});res.render("expenses/index.ejs", { allExpenses: expenses });
    })
);

// Filter by Days
app.get("/expenses/filter/date",isLoggedIn,async (req, res) => {
    let days = Number(req.query.days);
    let filter = {
    owner:req.user._id
};
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - days);
    const expenses = await Expense.find({ Date: { $gte: pastDate } });
    res.render("expenses/index.ejs", { allExpenses: expenses });
});

// Custom Date Filter
app.get("/expenses/custom-date", isLoggedIn,async (req, res) => {
    const startDate = new Date(req.query.start);
    const endDate = new Date(req.query.end);
    let filter = {
    owner:req.user._id
};
    const expenses = await Expense.find({
        Date: { $gte: startDate, $lte: endDate },
    });
    res.render("expenses/index.ejs", { allExpenses: expenses });
});

// Paginate
app.get("/expenses/paginate", isLoggedIn, async (req, res) => {
    let page = Number(req.query.page) || 1;
    let limit = Number(req.query.limit) || 5;
    let sortField = req.query.sort || "amount";
    let skip = (page - 1) * limit;
    const expenses = await Expense.find({ owner: req.user._id })
        .sort({ [sortField]: 1 })
        .skip(skip)
        .limit(limit);
    res.json(expenses);
});

// Search
app.get("/expenses/search",isLoggedIn, async (req, res) => {
    const keyword = req.query.keyword;
    if (!keyword) return res.json({ message: "Please provide keyword" });
   const expenses = await Expense.find({
    owner:req.user._id,
    $or:[{   title:{$regex: keyword,      $options:"i"
            }},
        {category:{ $regex: keyword,   $options:"i"
            } },
        { note:{   $regex: keyword, $options:"i"
            }}]
});
    res.json(expenses);
});

// ─── ANALYTICS ROUTES ────────────────────────────────────────

app.get("/analytics/total",isLoggedIn,async (req, res) => {
    try {
        const totalData = await Expense.aggregate([
             {  $match:{owner:req.user._id }
            },{ $group: { _id: null, totalSpent: { $sum: "$amount" } } },
        ]);
        console.log(totalData);
        res.json(totalData);
    } catch (err) {
        console.log(err);
        res.send(err.message);
    }
});
app.get("/analytics/monthly",isLoggedIn, async (req, res) => {
    const monthlyData = await Expense.aggregate([
    { $match:{ owner:req.user._id } },     {
            $group: {
                _id: { month: { $month: "$Date" } },
                totalSpent: { $sum: "$amount" },
            },
        },
    ]);
    res.json(monthlyData);
});

app.get("/analytics/top-category",isLoggedIn, async (req, res) => {
    const data = await Expense.aggregate([
         { $match:{ owner:req.user._id } },   
        { $group: { _id: "$category", totalSpent: { $sum: "$amount" } } },
        { $sort: { totalSpent: -1 } },
        { $limit: 1 },
    ]);
    res.json(data);
});
app.get("/analytics/daily",isLoggedIn, async (req, res) => {
    const data = await Expense.aggregate([
         { $match:{ owner:req.user._id } },   
        {
            $group: {
                _id: { day: { $dayOfMonth: "$Date" } },
                totalSpent: { $sum: "$amount" },
            },
        },
        { $sort: { "_id.day": 1 } },
    ]);
    res.json(data);
});

app.get("/analytics/dashboard",isLoggedIn, async (req, res) => {
    const totalSpent = await Expense.aggregate([
         { $match:{ owner:req.user._id } },   
        { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const topCategory = await Expense.aggregate([
         { $match:{ owner:req.user._id } },   
        { $group: { _id: "$category", totalSpent: { $sum: "$amount" } } },
        { $sort: { totalSpent: -1 } },
        { $limit: 1 },
    ]);
  const totalExpenses = await Expense.countDocuments({  owner:req.user._id});
    res.json({ totalSpent, topCategory, totalExpenses });
});
// /analytics/last30days
app.get("/analytics/last30days", isLoggedIn, async (req, res) => {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    const data = await Expense.aggregate([
        { $match: { owner: req.user._id, Date: { $gte: last30Days } } },
        { $group: { _id: null, totalSpent: { $sum: "$amount" } } },
    ]);
    res.json(data);
});

// /analytics/budget
app.get("/analytics/budget", isLoggedIn, async (req, res) => {
    const currentMonth = new Date().getMonth() + 1; // dynamic, not hardcoded
    const data = await Expense.aggregate([
        {
            $match: {
                owner: req.user._id,
                $expr: { $eq: [{ $month: "$Date" }, currentMonth] }
            }
        },
        {
            $group: {
                _id: null,
                totalSpent: { $sum: "$amount" },
                budget: { $first: "$budget" },
            },
        },
    ]);
    if (data.length === 0) return res.json({ message: "No expenses found" });
    const { totalSpent, budget } = data[0];
    const remaining = budget - totalSpent;
    const exceeded = totalSpent > budget;
    res.json({ totalSpent, budget, remaining, exceeded });
});
app.get("/analytics/stats",isLoggedIn, async (req, res) => {
    const stats = await Expense.aggregate([
         { $match:{ owner:req.user._id } },   
        {
            $group: {
                _id: null,
                totalSpent: { $sum: "$amount" },
                averageSpent: { $avg: "$amount" },
                maxExpense: { $max: "$amount" },
                minExpense: { $min: "$amount" },
                totalTransactions: { $sum: 1 },
            },
        },
    ]);
    let filter = {
    owner:req.user._id
};
    res.json(stats);
});

app.get("/analytics/category-insights", isLoggedIn,async (req, res) => {
    const insights = await Expense.aggregate([
         { $match:{ owner:req.user._id } },   {
            $group: {
                _id: "$category",
                totalSpent: { $sum: "$amount" },
                averageSpent: { $avg: "$amount" },
                totalTransactions: { $sum: 1 },
            },
        },
        { $sort: { totalSpent: -1 } },
    ]);
    res.json(insights);
});

app.get("/analytics/highest-expense",isLoggedIn, async (req, res) => {
    const highestExpense = await Expense.findOne({owner:req.user._id}).sort({ amount: -1 });
    res.json(highestExpense);
});

app.get("/analytics/lowest-expense", isLoggedIn,async (req, res) => {
   const lowestExpense = await Expense.findOne({ owner:req.user._id}).sort({ amount: 1 });
    res.json(lowestExpense);
});

app.get("/analytics/daily-spending",isLoggedIn, async (req, res) => {
    const data = await Expense.aggregate([
         { $match:{ owner:req.user._id } },   
        {
            $group: {
                _id: { day: { $dayOfMonth: "$Date" } },
                totalSpent: { $sum: "$amount" },
            },
        },
        { $sort: { "_id.day": 1 } },
    ]);
    res.json(data);
});

// ─── ERROR HANDLER ───────────────────────────────────────────
app.use((err, req, res, next) => {
    let { status = 500, message = "Something went wrong" } = err;
    res.status(status).render("expenses/error.ejs", { message });
});
// and at the bottom:
app.listen(process.env.PORT || 8080, () => {
    console.log("server is listening");
});
