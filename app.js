const express = require("express")
const app = express()
const path = require("path")
const nodemailer = require("nodemailer")
const env = require("dotenv").config()
const session = require("express-session")
const passport = require("./config/passport")
const db = require("./config/db")
const userRoute = require("./routes/userRoute")
const adminRoute = require("./routes/adminRoute")
// const flash = require('connect-flash'); // Remove this line
const { ensureAuthenticated, setUser } = require('./middleware/auth');
db();

app.use(express.json())
app.use(express.urlencoded({extended:true}))
app.use(session({
    secret:process.env.SESSION_SECRET,
    resave:false,
    saveUninitialized:true,
    cookie:{
        secure:false,
        httpOnly:true,
        maxAge:72*60*60*1000
    }
}))

app.use(passport.initialize())
app.use(passport.session())


app.use((req, res, next) => {
    res.set('cache-control', 'no-store')
    next()
})
app.set("view engine","ejs")
app.set("views",[path.join(__dirname,'views/user'),path.join(__dirname,'views/admin')])
app.use(express.static(path.join(__dirname,'public')))

app.use(setUser); // Apply the setUser middleware
app.use("/",userRoute)
app.use("/admin",adminRoute)
app.use('/user', ensureAuthenticated, userRoute);

const PORT = 5000 || process.env.PORT
app.listen(process.env.PORT, ()=>{
    console.log("Server is running on http://localhost:5000")    
    
})

module.exports = app;