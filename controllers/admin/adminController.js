const User = require("../../models/userSchema")
const mongoose = require("mongoose")
const bcrypt = require("bcrypt")


const pageError = async (req,res)=>{
    res.render('admin-error')
}

const loadLogin = (req,res)=>{
    if(req.session.admin){
        return res.redirect("/admin/dashboard")
    }
    res.render("admin-login",{message:null})
}


const login = async (req,res)=>{
    try {
        const {email,password} = req.body;
        const admin = await User.findOne({email,isAdmin:true})

        if(admin){
            const passwordMatch = bcrypt.compare(password,admin.password)
            if(passwordMatch){
                req.session.admin = true
                return res.redirect('/admin')
            }else {
                return res.redirect('/login')
            }
        }
        else {
            return res.redirect('/login')
    }
    } catch (error) {
        console.log('Login error',error);
        return res.redirect('pageError')
        
    }
}


const loadDashboard = async (req,res)=>{
    if(req.session.admin){
        try{
            res.render("dashboard")
        }catch (error){
            res.redirect('/pageError')
        }
    }
}


const logout = async (req, res) => {
    try {
        req.session.destroy(err => {
            if (err) {
                console.log("Error destroying session", err);
                return res.redirect("/pageError"); 
            }
            return res.redirect("/admin"); 
        });
    } catch (error) {
        console.log("Error during logout", error);
        res.redirect('/pageError'); 
    }
};




module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageError,
    logout,

}