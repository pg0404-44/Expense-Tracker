const express = require("express");
const router = express.Router();
const passport = require("passport");

const wrapAsync =
require("../utils/wrapAsync");

const User =
require("../models/user");

// SIGNUP FORM
router.get("/signup",(req,res)=>{
    res.render("users/signup.ejs");
});

router.post("/signup", wrapAsync(async(req,res,next)=>{
        try{
            let { username, email, password } = req.body;
            const newUser = new User({ email, username});
            const registeredUser =await User.register(newUser,password);
            req.login(registeredUser,(err)=>{
                if(err){
                    return next(err);}
                req.flash("success","Welcome to Expense Tracker!" );
                res.redirect("/listexpenses");
            });        } catch(err){
            req.flash("error", err.message);
            res.redirect("/signup");
        }  })
);
// LOGIN FORM
router.get("/login",(req,res)=>{
    res.render("users/login.ejs");
});

// LOGIN
router.post(
    "/login",passport.authenticate("local",{
        failureRedirect:"/login",
        failureFlash:true
    }),
    async(req,res)=>{
        req.flash( "success","Welcome back!"
        );res.redirect("/listexpenses");
    }
);
// LOGOUT
router.get("/logout",(req,res,next)=>{
    req.logout((err)=>{
     if(err){
            return next(err);
        }
        req.flash( "success", "Logged out successfully" );
        res.redirect("/login");
    });
});
module.exports = router;