const mongoose = require('mongoose');
const User = mongoose.model('User');
const promisify = require('es6-promisify');

exports.loginForm = (req, res) => {
    res.render("login", {title: 'Login'})
};

exports.registerForm = (req, res) => {
    res.render("register", {title: 'Register'});
};

exports.validateRegister = (req, res, next) => {
    req.sanitizeBody('name');
    req.checkBody("name", "You must supply a name ooo").notEmpty();
    req.checkBody("email", "Email not valid oooo").isEmail();
    req.sanitizeBody("email").normalizeEmail({
        remove_dots: false,
        remove_extension: false,
        gmail_remove_subaddress: false

    });
    req.checkBody("password", "password cannot be blank oooo").notEmpty();
    req.checkBody("password-confirm", "Confirm password cannot be blank ooo").notEmpty();
    req.checkBody("password-confirm", "Oops! Your passwords do not match oooo").equals(req.body.password);

    const errors = req.validationErrors();
    if (errors) {
        req.flash('error', errors.map(err => err.msg));
        res.render("register", {title: 'Register', body: req.body, flashes: req.flash()})
        return; //stop the func
    }
    next();
};

exports.register = async (req, res, next) => {
    const user = new User({email: req.body.email, name: req.body.name});
    // User.register(user, req.body.password, function(err, user) {

    // });
    const registerWithPromise = promisify(User.register, User);
    await registerWithPromise(user, req.body.password);
    next() //pass to auth controller
};

exports.account = async (req, res) => {
    res.render("account", {title: "Edit your account"});
};

exports.updateAccount = async (req, res) => {
    const updates = {
        name: req.body.name,
        email: req.body.email
    };
    const user = await User.findOneAndUpdate(
        {_id: req.user._id},
        { $set: updates},
        { new: true, runValidators: true, context: 'query' }
    );
    req.flash("success", "updated successfully");
    res.redirect('back');
};