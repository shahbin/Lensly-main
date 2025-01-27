const User = require("../models/userSchema")

const checkUser = async (req, res, next) => {
    if(req.session.user) {
        User.findById(req.session.user)
        .then(data =>{
            if(data.isBlocked){
                return res.redirect('/login')
            }
        })
        res.redirect('/')
    } else {
        next();
    }
}

const checkAdmin = async (req, res, next) => {
    if(req.session.admin) {
        res.redirect('/admin/dashboard')
    } else {
        next();
    }
}

const userAuth = (req,res,next)=>{
    if(req.session.user){
        User.findById(req.session.user)
        .then(data =>{
            if(data && !data.isBlocked){
                next()
            }else{
                res.redirect('/login')
            }
        })
        .catch(error =>{
            console.log("Error in userAuth");
            res.status(500).send("Internal Server Error")
        })
    }else{
        res.redirect('/login')
    }
}


const adminAuth = (req,res,next)=>{
    User.findOne({isAdmin:true})
    .then(data =>{
        if(data){
            next()
        }else{
            res.redirect('/admin/login')
        }
    })
    .catch(error =>{
        console.log("Error in adminAuth");
        res.status(500).send("Internal Server Error")
    })
}



module.exports = {
    userAuth,
    adminAuth,
    checkUser,
    checkAdmin
}