//Ryan McOmber
// Web APi
//Assign 3
//users: signup and signin
//movies: CRUD, getall

var express = require('express');
var path = require('path');
var http = require('http');
var bodyParser = require('body-parser');
var passport = require('passport');
//var schemas = require('./schemas')
var jwt = require('jsonwebtoken');
var dotenv = require('dotenv').config(); //Needed for process.env.UNIQUE_KEY
var mongoose = require('mongoose');
var bcrypt = require('bcrypt-nodejs');
var Schema = mongoose.Schema;
var port = 8082;
var minAmountOfCharacters = 3;

var app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(passport.initialize());
var router = express.Router(); // get instance of router

mongoose.connect(process.env.DB , (err, database) => {
    if (err) throw err;
    console.log("Connected to the database.");
    db = database;
    console.log("Database connected on " + process.env.DB);
});

var userSchema = new Schema({
    name: String,
    username: {type: String, required: true, index: { unique: true}}, 
    password: {type: String, required: true, select: false}
});
var User = mongoose.model("User", userSchema);

// hash the password before the user is saved
userSchema.pre('save', function(next) {
    var user = this;

    // hash the password only if the password has been changed or user is new
    if (!user.isModified('password')) return next();

    // generate the hash
    bcrypt.hash(user.password, null, null, function(err, hash) {
        if (err) return next(err);

        // change the password to the hashed version
        user.password = hash;
        next();
    });
});


function minLength(actors){
    return actors.length >= 3;
}
var movieSchema = new Schema({
    title:{type: String, required: true, unique: true},
    yearReleased: {type: Number, min:1600, max:9999}, 
    genre: ['Action','Adventure','Comedy','Drama', 'Fantasy', 'Horror', 'Mystery', 'Thriller', 'Western'],
    actors: {type:[
        {name:{type: String, required: true},
        characterName: {type: String, required: true}}]
        ,validate:[minLength, "Must be a minimum of 3 actors"]}
});
var Movie = mongoose.model("Movie", movieSchema);

router.post('/signup', (req, res) => {
    if (!req.body.username || !req.body.password || !req.body.name) {
        res.status(422).json({success: false, msg: 'Please pass username, name, and password.'});
    } else {
        var newUser = new User(req.body);
        
        // save the user
        newUser.save()
            .then(item => {
                res.json({success: true, msg: 'Successful created new user.'});
            })
            .catch(err => {
                res.status(422).send("Unable to save to database");
            });
    }
});


router.post('/signin', (req, res) => {
    var userNew = new User(req.body);

    User.findOne({ username: userNew.username }).select('name username password').exec(function(err, user) {
        if (err) res.send(err);

        //bcrypt compares unhashed password and saved hashed password 
        bcrypt.compare(userNew.password, user.password, (err, isMatch) => {
            if (isMatch) {
                var userToken = {id: user._id, username: user.username};
                var token = jwt.sign(userToken, process.env.SECRET_KEY);
                res.json({success: true, message: 'Enjoy the jwt token!', token: token});
            }
            else {
                res.status(401).send({success: false, msg: 'Authentication failed. Wrong password.'});
            }
        });
    });
});
router.use('/movies',(req, res, next) => { 
    //First must authenticate
    var token = req.headers['x-access-token'] || req.body.token || req.query.token; 
    var secretOrKey = process.env.SECRET_KEY;
    //console.log("Token:  " + token);
    if (token != null) { 
        jwt.verify(token, secretOrKey, function(err, decoded) { 
            if (err) { 
                return res.status(403).send({ 
                    success: false, 
                    message: 'Failed to authenticate token.' 
                });
            } else { 
                console.log("User authenticated.");
                req.decoded = decoded;
                next();
            }
        });
    } else {
        return res.status(403).send({
        success: false,
        message: 'No token provided.'
        });
    }
});

//Create
router.post('/movies/save', (req, res) => {

    console.log("Going to save a movie...");

    //Needs title, yearReleased, genre, >= 3 actorName, >= 3 actorCharacterName
    if (    !req.body.title
         || !req.body.yearReleased
         || !req.body.genre 
         || !req.body.actors
        ) {
        res.json({success: false, msg: 'Please pass title, yearReleased, genre, actors.'});
    } 
    else { 
        var newMovie = new Movie(req.body)
        // save the user
        newMovie.save()
            .then(item => {
                res.json({success: true, msg: 'Successful created new movie.'});
            })
            .catch(err => {
                res.status(422).send("Unable to save movie to database");
            });
    }
});


//Read
router.get('/movies/get', (req, res) => {
    console.log("Going to get a movie...");
    var id = req.headers._id;
    Movie.findById(id, function(err, movie) {
      if (err) res.send(err);
  
      var userJson = JSON.stringify(movie);
      // return that user
      res.json(movie);
    });
});

//Get all
router.get('/movies/getall', (req, res) => {
    Movie.find(function (err, movies) {
        if (err) res.send(err);
        // return the users
        res.json(movies);
      });
});

//Update    
router.put('/movies/update', (req, res) => {
    console.log("Going to update a movie...");
    var id = req.headers._id;
    Movie.findOne({_id: id}).exec(function(err, movie) {
      if (err) res.send(err);
        // update the users info only if its new
        if (req.body.title) movie.title = req.body.title;
        if (req.body.yearReleased) movie.yearReleased = req.body.yearReleased;
        if (req.body.genre) movie.genre = req.body.genre;
        if (req.body.actors) movie.actors = req.body.actors;

        // save the user
        movie.save(function (err) {
            if (err) res.send(err);

            // return a message
            res.json({message: 'Movie updated!'});
        });  
    });
});


//Delete
router.delete('/movies/delete', (req, res) => {
    console.log("Going to delete a movie...");
    if (!req.body._id) {
       res.json({success: false, msg: 'Please pass movie id.'});
   } 
   else { 
        Movie.findOne({ _id: req.body._id }).select('_id').exec(function(err, movie) {
            if (err) res.send(err);
        
             movie.remove()
            .then(item => {
                res.json({success: true, msg: 'Successful removed movie.'});
             })
            .catch(err => {
                res.status(422).send("Unable to remove movie from database");
            });
        });
    }
});
app.use('/', router);
app.listen(process.env.PORT || port);
console.log("Server listening on port " + port);
