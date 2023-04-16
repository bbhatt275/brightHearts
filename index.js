require('dotenv').config()

var express = require('express');   //import express
var ejs = require('ejs')
var app = express();                //import express function
const session = require('express-session');
const nodemailer = require('nodemailer');
app.set('view engine', 'ejs');      // set the view engine to ejs
app.use(express.static('public'))   //set public folder

app.use(session({
  resave: false,
  saveUninitialized: true,
  secret: 'SECRET' 
}));

const admin = require('firebase-admin');      //import firebase-admin
const serviceAccount = require("./key.json"); //import service account key

const bodyParser = require('body-parser');

//initialise body parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); 

app.use(express.urlencoded({extended: true}))
app.use(express.json({extended: true}))

//initialize app
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Initialize Cloud Firestore and get a reference to the service
const db = admin.firestore();

//----------------------------------------------------------------------------------------------------------------------------
//passport code---------
const passport = require('passport');
var userProfile;
app.use(passport.initialize());
app.use(passport.session());

app.get('/success', async (req, res) => {

  user = {
    googleId: userProfile.id,
    name: userProfile.displayName,
    email: userProfile.emails[0].value
  }
  
  console.log(user)
  
  var UserData = await db.collection('usersdata').doc(user.email).get();
  if (!UserData.exists) {

    console.log("User Does not exists.")

    const docRef = db.collection('usersdata').doc(user.email);
      docRef.set({
        googleId: user.googleId,
        name: user.name,
        email: user.email,
        signup: "google",
        type: 'null'
      });

      res.render('selectType', {
            email: user.email
          });

      console.log("user added")
  } else {
      console.log("User Already Exists")

      email = user.email;
  
      const data = await db.collection('usersdata').doc(user.email).get();
      if(!data) {
        console.log("Dont try to hack");
      } else {
        var UserSession = data.data();
        var type = UserSession.type;
        if(type == 'null') {
          res.render('selectType', {
            user: UserSession
          });
        } else {
          if(type == 'student') {
            res.render('student_dashboard', {
              user: UserSession
            })
          } else if(type == 'mentor') {

            var field = UserSession.field
            console.log(field)

            const Arr = await db.collection('fields').doc(field).get();
            const fieldArr = await Arr.data();

            console.log(fieldArr)

            res.render('mentor_dashboard', {
              user: UserSession,
              requestArr: fieldArr.requests
            })
          }
        }
      }
  }
});
app.get('/error', (req, res) => res.send("error logging in"));

passport.serializeUser(function(user, cb) {
  cb(null, user);
});

passport.deserializeUser(function(obj, cb) {
  cb(null, obj);
});

/*  Google AUTH  */
 
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
const GOOGLE_CLIENT_ID = "367377851842-416s56b0llr832koheb6q6n79trdtdb4.apps.googleusercontent.com";
const GOOGLE_CLIENT_SECRET = "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";
passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: "https://misty-duck-leotard.cyclic.app/auth/google/callback"
  },
  function(accessToken, refreshToken, profile, done) {
      userProfile=profile;
      return done(null, userProfile);
  }
));
 
app.get('/auth/google', 
  passport.authenticate('google', { scope : ['profile', 'email'] }));
 
app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/error' }),
  function(req, res) {
    // Successful authentication, redirect success.
    res.redirect('/success');
  });


// index page
app.get('/', (req, res) => {
  res.render('index');
});



app.post("/choosen/student", (req, res) => {
  var email = req.body.email
  console.log(email)

  db.collection("usersdata").doc(email).update({
    type: 'student',
  })
.then( async () => {
  const data = await db.collection('usersdata').doc(user.email).get();
  var UserSession = data.data();

    res.render('student_dashboard', {
      user: UserSession
    });
})
.catch((error) => {
    console.error("Error updating document: ", error);
});
})


//get mentor details
app.post("/choosen/mentor", async (req, res) => {

  var email = req.body.email
  var desc = req.body.desc
  var field = req.body.field  

  console.log(email)
  console.log(desc)
  console.log(field)

  db.collection("usersdata").doc(email).update({
    type: 'mentor',
    desc: desc,
    field: field
  })
.then( async () => {
  const data = db.collection('usersdata').doc(user.email).get();
  var UserSession = (await data).data();
  var field = UserSession.field
  console.log(field)

  const Arr = await db.collection('fields').doc(field).get();
  const fieldArr = Arr.data();

  console.log(fieldArr)

  res.render('mentor_dashboard', {
    user: UserSession,
    requestArr: fieldArr.requests
  })
})
.catch((error) => {
    console.error("Error updating document: ", error);
});
})


app.get("/add/request/:email", (req, res) => {
  email = req.params.email;

  res.render("add", {email})
})


app.post("/student/request", (req, res) => {

  var title = req.body.title
  var email = req.body.email
  var desc = req.body.desc
  var field = req.body.field  

  console.log(email)
  console.log(desc)
  console.log(field)
  console.log(title)

  var item = {
    title: title,
    email: email,
    desc: desc,
  }

  db.collection("fields").doc(field).update({
    requests: admin.firestore.FieldValue.arrayUnion(item)
  })
.then(() => {
  db.collection("usersdata").doc(email).update({
    requests: admin.firestore.FieldValue.arrayUnion(item)
  })
  const userdata = db.collection('usersdata').doc(email).get().then((userdata) => {
    var usersession = userdata.data();
    console.log(usersession.requests)
    res.render("student_dashboard", {
      user: usersession
    })
  })
})
.catch((error) => {
    console.error("Error updating document: ", error);
});
})

app.get('/confirmproject/:useremail/:contactemail/:projecttitle', (req, res) => {
  let title = req.params.projecttitle
  let contactemail = req.params.contactemail
  let useremail = req.params.useremail


        //send verfication email
        let mailTransporter = nodemailer.createTransport({
      
          service: "hotmail",
          auth: {
            user: "brighthearts@outlook.com",
            pass: 'ReactExpressNode@234'
          },
        
        tls: {
          rejectUnauthorized: false
      }
    });
     
    let mailDetails = {
        from: "brighthearts@outlook.com",
        to: contactemail,
        subject: 'Someone applied to volunteer you with your project',
        html: 'Hello, We have found a volunteer to help you. with ' + title + 'You can email him right away to continue ' + useremail + '.'
    }
        
     
    mailTransporter.sendMail(mailDetails, function(err, data) {
        if(err) {
            console.log(err);
        } else {
            console.log('Email sent')
            res.send("<h1>Email sent to user</h1><br><h2>They will respond to you soon</h2>")
        }
    });
})

app.get("/about", (req, res) => {
  res.render("about")
})
app.get("/contact", (req, res) => {
  res.render("contact")
})


app.listen(8080);
console.log('Server is listening on port 8080');