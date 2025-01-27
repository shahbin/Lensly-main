const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');

// ...existing code...

router.get('/signup', (req, res) => {
    console.log('User:', req.user); // Debugging line
    res.render('user/signup', {
        user: req.user || null,
        message: req.query.message || ''
    });
});

// ...existing code...

module.exports = router;
