function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}

function setUser(req, res, next) {
    res.locals.user = req.user || null;
    next();
}

module.exports = {
    ensureAuthenticated,
    setUser
};
