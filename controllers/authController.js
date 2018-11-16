const passport = require('passport');
const mongoose = require('mongoose');
const User = mongoose.model('User');
const crypto = require('crypto');
const promisify = require('es6-promisify');
const mail = require('../handlers/mail');

exports.login = passport.authenticate('local', {
    failureRedirect: '/login',
    failureFlash: "Failed login!",
    successRedirect: "/",
    successFlash: "You are now logged in"
});

exports.logout = (req, res) => {
    req.logout();
    req.flash("success", "logged out! 😄");
    res.redirect("/");
};

exports.isLoggedIn = (req, res, next) => {
    //check if uthenticated
    if (req.isAuthenticated()) {
        return next(); //logged in
    }
    req.flash("error", "Please login in");
    res.redirect("/login");
};

exports.forgot = async (req, res) => {
    const user = await User.findOne({email: req.body.email});
    if (!user) {
        console.log(user)
        req.flash("error", "A password reset intruction has been mailed to you");
        return res.redirect("/login");
    }

    user.resetPasswordToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordExpires = Date.now() + 3600000; //one hour from now
    await user.save();

    const resetUrl = `http://${req.headers.host}/account/reset/${user.resetPasswordToken}`;
    await mail.send({
        //email: user.email,
        user,
        filename: 'password-reset',
        subject: 'Password Reset',
        resetUrl
    });
    req.flash("success", `you have bee emailed`);
    res.redirect("/login")
};

exports.reset = async (req, res) => {
    const user = await User.findOne({
        resetPasswordToken: req.params.token,
        resetPasswordExpires: { $gt: Date.now() }
    });
    if (!user) {
        req.flash("error", 'Password token is isvalid or has expired');
        return res.redirect("/login");
    }
    //if there is a user
    res.render("reset", {title: 'Reset your password'});
};

exports.confirmPasswords = (req, res, next) => {
    if (req.body.password === req.body['password-confirm']) {
        return next(); //keep it going
    }
    req.flash("error", "passwords do not match");
    res.redirect("back");
};

exports.updatePassword = async (req, res) => {
    const user = await User.findOne({
        resetPasswordToken: req.params.token,
        resetPasswordExpires: { $gt: Date.now() }
    });
    if (!user) {
        req.flash("error", 'Password token is isvalid or has expired');
        return res.redirect("/login");
    }

    //update the password
    const setPassword = promisify(user.setPassword, user);
    await setPassword(req.body.password);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    const updatedUser = await user.save();
    await req.login(updatedUser);
    req.flash("success", "password reset successful");
    res.redirect("/");
};
