// Author: Kenny Boluka
// Version: 1.0
// Purpose: Main file for the application. This file will be used to connect to the database, set up the server, and set up the routes for the application.
// Date Created: 2021-09-20

// Importing the required packages

const express = require('express');
const app = express();

const bodyParser = require('body-parser');
const ejs = require('ejs');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const randToken = require('rand-token');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv').config();

//Models
const User = require('./models/user');
const Reset = require('./models/reset');
const Receipe = require('./models/receipe');
const Favorite = require('./models/favorite');
const Ingredients = require('./models/ingredients');
const Schedule = require('./models/schedule');

// Session

app.use(session({
    secret : 'mysecret',
    resave: false,
    saveUninitialized: false,
}));

// Passport 

app.use(passport.initialize());
app.use(passport.session());

// Setting up the server

//Mongoose

mongoose.connect(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true });

// PassportLocalMongoose

passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

//EJS
app.set('view engine', 'ejs');

//Public
app.use(express.static('public'));

//BodyParser
app.use(bodyParser.urlencoded({ extended: false }));


const methodOverride = require('method-override');
const flash = require('connect-flash');
app.use(flash());

app.use((req, res, next) => {
    res.locals.currentUser = req.user;
    res.locals.error = req.flash('error');
    res.locals.success = req.flash('success');
    next();
})

app.use(methodOverride('_method')); 

const port = 3000;

// Importing the routes

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/signup', (req, res) => {
    res.render('signup');
});

app.post('/signup',(req, res) => {
    // saltRounds = 10;
    // bcrypt.hash(req.body.password, saltRounds, (err, hash) => {
    //     const user = new User({
    //         username: req.body.username,
    //         password: hash,
    //     });
    //     User.create(user)
    //     .then(result => {
    //         res.render('index');
    //     })
    //     .catch(err => {
    //         console.log(err);
    //     });     
    // })

    const user = new User({
        username: req.body.username
    });
    User.register(user, req.body.password, (err, user) => {
        if(err){
            console.log(err);
            req.flash('error', 'Username already exists');
            res.render('signup');
        } else {
            passport.authenticate('local')(req, res, () => {
                req.flash('success', 'Signed up successfully');
                res.redirect('login');
            });
        }
    });
})

app.get('/login', (req, res) => {
    res.render('login');
}); 

app.post('/login', (req, res) => {
    // const username = req.body.username; 
    // const password = req.body.password;
    // User.findOne({username: username})
    // .then(user => {
    //     if(user){
    //         bcrypt.compare(password, user.password, (err, result) => {
    //             if(result){
    //                 res.render('index');
    //             } else {
    //                 res.render('login');
    //             }
    //         }   
    //         )
    //     } else {
    //         res.render('login');
    //     }
    //})
    //.catch(err => {
    //   console.log(err);
    //});
    const user = new User({
        username: req.body.username,
        password: req.body.password,
    });
    req.login(user, (err) => {
        if(err){
            req.flash('error', 'Incorrect username or password');
            console.log(err);
        } else {
            passport.authenticate('local')(req, res, () => {
                res.redirect('/dashboard');
            });
        }
    });
});

app.get('/dashboard', isLoggedIn, (req, res) => {
    res.render('dashboard');    
}   );

app.get('/logout', (req, res) => {
    req.logout((err) => {
        if(err){
            req.flash('error', 'Error logging out');
            console.log(err);
        } else {
            req.flash('success', 'Logged out successfully');
            res.redirect('/login');
        }
    });
});

app.get('/forgot', (req, res) => {
    res.render('forgot');
});

app.post('/forgot', (req, res) => {
    User.findOne({username: req.body.username})
        .then(data => {
            const token = randToken.generate(16);
            Reset.create({
                username: data.username,
                resetPasswordToken: token,
                resetPasswordExpires: Date.now() + 3600000,
            })
            const transporter = nodemailer.createTransport({
                host: "smtp.gmail.com",
                port: 465,
                secure: true,
                auth: {
                    type: "OAuth2",
                    clientId: process.env.CLIENT_ID,
                    clientSecret: process.env.CLIENT_SECRET,
                },
            });

            const mailOptions = {
                from: 'kingcooking284@gmail.com',
                to : req.body.username,
                subject: 'Reset Password',
                text: 'Click the link to reset your password: http://localhost:3000/reset/' + token,
                auth: {
                    user: 'kingcooking284@gmail.com',
                    refreshToken:process.env.REFRESH_TOKEN,
                    accessToken: process.env.ACCESS_TOKEN,
                    expires: 1484314697598
                }
            };
            console.log("Sending mail");

            transporter.sendMail(mailOptions, (err, response) => {
                if(err){
                    req.flash('error', 'Error sending email')
                    console.log(err);
                } else {
                    console.log('Email sent');
                    req.flash('success', 'Email sent');
                    res.redirect('/login');
                }
            }); 
        })
        .catch(err => {
            console.log(err);
            req.flash('error', 'Error sending email')
            res.redirect('/forgot');
        });
});

app.get('/reset/:token', (req, res) => {
    Reset.findOne({resetPasswordToken: req.params.token, resetPasswordExpires: {$gt: Date.now()}})
        .then(data => {
            if(data){
                res.render('reset', {token: req.params.token});
            } else {
                res.redirect('/forgot');
            }
        })
        .catch(err => {
            console.log(err);
            req.flash('error','Token expired')
            res.redirect('/login');
        });
})


app.post('/reset/:token', (req, res) => {
    Reset.findOne({resetPasswordToken: req.params.token, resetPasswordExpires: {$gt: Date.now()}})
        .then(data => {
            if(req.body.password===req.body.password2){
                User.findOne({username: data.username})
                    .then(user => {
                        user.setPassword(req.body.password, (err, user) => {
                            if(err){
                                console.log(err);
                            } else {
                                user.save();
                                const updateReset = {
                                    resetPasswordToken: null,
                                    resetPasswordExpires: null,    
                                }
                                Reset.findOneAndUpdate({resetPasswordToken: req.params.token}, updateReset)
                                    .then(result => {
                                        console.log(result);
                                        req.flash('success', 'Password reset successfully');
                                        res.redirect('/login');
                                    })
                                    .catch(err => {
                                        req.flash('error', 'Error resetting password');
                                        console.log(err);
                                    });
                            }
                        });
                    })
                    .catch(err => {
                        req.flash('error', 'Error resetting password');
                        console.log(err);
                    });
            }
        })
        .catch(err => {
            console.log(err);
            req.flash('error', 'Error resetting password');
            res.redirect('/login');
        });
});

// connectionFunction()

function isLoggedIn(req, res, next) {
    if(req.isAuthenticated()){
        return next();
    } else {
        req.flash('error', 'Please login first');
        res.redirect('/login');
    }
    
}

// Receipes

app.get('/dashboard/myreceipes', isLoggedIn, (req, res) => {
    Receipe.find({
        user: req.user.id
    })
    .then(receipe => {
        res.render('receipe', {receipe: receipe});
    })
    .catch(err => {
        console.log(err);
    })
})

app.get('/dashboard/newreceipe', isLoggedIn, (req, res) => {
    res.render('newreceipe');
});

app.post('/dashboard/newreceipe', (req, res) => {
    const receipe = new Receipe({
        name: req.body.receipe,
        image: req.body.logo,
        user: req.user.id
    });
    Receipe.create(receipe)
        .then(result => {
            req.flash('success', 'Receipe added successfully');
            res.redirect('/dashboard/myreceipes');
        })
        .catch(err => {
            console.log(err);
        });      
})

// Ingredients

app.get('/dashboard/myreceipes/:id', (req, res) => {
    Receipe.findOne({user: req.user._id ,_id: req.params.id})
        .then(receipe => {
            Ingredients.find({
                user: req.user._id,
                receipe: req.params.id
            })
            .then(ingredients => {
                res.render('ingredients', 
                {ingredients: ingredients,
                receipe: receipe});
            })
            .catch(err => {
                console.log(err);
            });
        })
        .catch(err => {
            console.log(err);
        });
});

app.get('/dashboard/myreceipes/:id/newingredient', (req, res) => {
    Receipe.findById({_id: req.params.id})
        .then(receipe => {
            res.render('newingredient', {receipe: receipe});
        })
        .catch(err => {
            console.log(err);
        });
});

app.post('/dashboard/myreceipes/:id', (req, res) => {
    const newIngredients = new Ingredients({
        name: req.body.name,
        bestDish: req.body.dish,
        user: req.user.id,
        quantity: req.body.quantity,
        receipe: req.params.id
    });
    Ingredients.create(newIngredients)
        .then(result => {
            req.flash('success', 'Ingredient added successfully');
            res.redirect('/dashboard/myreceipes/' + req.params.id);
        })
        .catch(err => {
            console.log(err);
        });
})

app.delete('/dashboard/myreceipes/:id', isLoggedIn, (req, res) => {
    Receipe.deleteOne({_id: req.params.id})
        .then(result => {
            req.flash('success', 'Receipe deleted successfully');
            res.redirect('/dashboard/myreceipes');
        })
        .catch(err => {
            console.log(err);
        });
});

app.delete('/dashboard/myreceipes/:id/:ingredientsid/', isLoggedIn, (req, res) => {
    Ingredients.deleteOne({_id: req.params.ingredientsid})
        .then(result => {
            req.flash('success', 'Ingredient deleted successfully');
            res.redirect('/dashboard/myreceipes/' + req.params.id);
        })
        .catch(err => {
            console.log(err);
        });
})

app.post('/dashboard/myreceipes/:id/:ingredientsid/edit', isLoggedIn, (req, res) => {
    Receipe.findOne({user: req.user._id ,_id: req.params.id})
        .then(receipe => {
            Ingredients.findOne({
                _id: req.params.ingredientsid,
                receipe: req.params.id
            })
                .then(ingredients => {
                    res.render('edit', {
                        ingredients: ingredients,
                        receipe: receipe
                    });
                })
                .catch(err => {
                    console.log(err);
                });
        })
        .catch(err => {
            console.log(err);
        });
});

app.put('/dashboard/myreceipes/:id/:ingredientsid', isLoggedIn, (req, res) => {
    const updateIngredients = {
        name: req.body.name,
        bestDish: req.body.dish,
        user: req.user.id,
        quantity: req.body.quantity,
        receipe: req.params.id
    }

    Ingredients.findByIdAndUpdate({_id: req.params.ingredientsid}, updateIngredients)
        .then(result => {
            req.flash('success', 'Ingredient updated successfully');
            res.redirect('/dashboard/myreceipes/' + req.params.id);
        })
        .catch(err => {
            console.log(err);
        });
});

// Favorites

app.get('/dashboard/favourites', isLoggedIn, (req, res) => {
    Favorite.find({
        user: req.user.id
    })
    .then(favorite => {
        res.render('favourites', {favorite: favorite});
    })
    .catch(err => {
        console.log(err);
    });
});

app.get('/dashboard/favourites/newfavourite', isLoggedIn, (req, res) => {
    res.render('newfavourite');
});

app.post('/dashboard/favourites', isLoggedIn, (req, res) => {
    const newFavorite = new Favorite({
        image: req.body.image,
        title: req.body.title,
        description: req.body.description,
        user: req.user.id
    });
    Favorite.create(newFavorite)
        .then(result => {
            req.flash('success', 'Favorite added successfully');
            res.redirect('/dashboard/favourites');
        })
        .catch(err => {
            console.log(err);
        });
})

app.delete('/dashboard/favourites/:id', isLoggedIn, (req, res) => {
    Favorite.deleteOne({_id: req.params.id})
        .then(result => {
            req.flash('success', 'Favorite deleted successfully');
            res.redirect('/dashboard/favourites');
        })
        .catch(err => {
            console.log(err);
        });
});

// Schedule

app.get('/dashboard/schedule', isLoggedIn, (req, res) => {
    Schedule.find({
        user: req.user.id
    })
    .then(schedule => {
        res.render('schedule', {schedule: schedule});
    })
    .catch(err => {
        console.log(err);
    });
});

app.get('/dashboard/schedule/newSchedule', isLoggedIn, (req, res) => {
    res.render('newSchedule');
});

app.post('/dashboard/schedule', isLoggedIn, (req, res) => {
    const newSchedule = new Schedule({
        receipeName: req.body.receipename,
        scheduleDate: req.body.scheduleDate,
        user: req.user.id,
        time: req.body.time
    });
    Schedule.create(newSchedule)
        .then(result => {
            req.flash('success', 'Schedule added successfully');
            res.redirect('/dashboard/schedule');
        })
        .catch(err => {
            console.log(err);
        });
})

app.delete('/dashboard/schedule/:id', isLoggedIn, (req, res) => {
    Schedule.deleteOne({_id: req.params.id})
        .then(result => {
            req.flash('success', 'Schedule deleted successfully');
            res.redirect('/dashboard/schedule');
        })
        .catch(err => {
            console.log(err);
        });
});

app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});

