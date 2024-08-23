const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const mongoose = require('mongoose');
const cookieParser = require("cookie-parser");
const ejs = require("ejs");

const helpers = require('./helpers');

// initialize the application
const app = express();
const server = require('http').createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);

// set the view engine and licate the views folder
app.set('view engine', 'ejs');
app.set('views', (__dirname + '/views'));

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static(__dirname + '/public'));
app.use(cookieParser());

mongoose.connect('mongodb://localhost:27017/BingoDB');

const Schema = mongoose.Schema;
// const ObjectId = Schema.ObjectId;

const playerSchema = new Schema({
  ID: String,
  DisplayName: String,
  BoardOrder: [Number],
  BoardState: [Boolean],
  WinCondition: Boolean,
});

const roomSchema = new Schema ({
  Name: String,
  ID: String,
  Events: [String],
  Players: [playerSchema],
});

const Room = mongoose.model(
  "Room",
  roomSchema
);

const Player = mongoose.model(
  "Player",
  playerSchema
);


// root GET request
app.get('/', (req, res) => {
  res.render("home");
});

io.on("connection", (socket) => {
  console.log('A user connected');
  socket.on('disconnect', () => {
    console.log('user disconnected');
  });

  socket.on('room ID', (ID) => {
    socket.join(ID);
    console.log("A user joined room " + ID);
    console.log(socket.rooms);
  })

});

app.post('/', async (req, res, next) => {
  if (req.cookies.roomID) {
    res.redirect("/rooms/" + req.cookies.roomID);
  }
  else {

    // When form is sent, create a new room instance
    const roomInstance = new Room();

    // Create a new 6-letter ID for this specific room
    roomInstance.ID = helpers.makeID(8);

    res.cookie("roomID", roomInstance.roomID, {maxAge: 3600000000}, "/");

    let events = [];
    // Get the events from the 9 squares in form
    for (var i = 1; i <= 9; i++) {
      events.push(req.body[i]);
    }
    roomInstance.Events = events;

    // Save the room with all attributes.
    await roomInstance.save();

    res.redirect("/rooms/" + roomInstance.ID);
  }
});

// Middleware for checking roomID validity in the URL
async function checkRoomID(req, res, next) {
  let roomIDs = [];

  // Get the IDs of all existing rooms to see if the requested URL is valid
  await Room.find({}, 'ID').exec()
    .then(function(results) {
      results.forEach((result) => roomIDs.push(result.ID));
    })
    .catch(function(err) {
      console.log(err);
      res.redirect("/error");
    }
  );

  if (roomIDs.includes(req.params.roomID)) {
    console.log("ROOM ID VERIFIED");
    next();
  }
  else {
    console.log("ERROR: No such room: " + req.params.roomID);
    res.redirect("/error");
  }
}

// Route to the right sub-URL depending on cookie info
app.get("/rooms/:roomID", checkRoomID, async (req, res) => {
  if (typeof req.cookies.playerID == String) {
    res.redirect("/rooms/" + req.params.roomID + "/" + req.cookies.playerID);
    // res.redirect("/rooms/" + req.params.roomID + "/boards");
  }
  else {
    res.redirect("/rooms/" + req.params.roomID + "/signup");
  }
});

app.get('/rooms/:roomID/boards', checkRoomID, async (req, res) => {

  // Refresh the cookie
  res.cookie("roomID", req.params.roomID, {maxAge: 3600000000}, "/");

  let squares = [];
  // Query this room's squares from database
  await Room.find({ ID: req.params.roomID }, 'Events').exec()
    .then(function(results) {
      squares = results[0].Events;
    }
  );

  // Render the room with the found roomID and squares.
  res.render("room", { 
    roomID: req.params.roomID,
    squares: squares,
  });
}); 

app.get("/rooms/:roomID/signup", checkRoomID, (req, res) => {
  res.render("signup", {
    roomID: req.params.roomID,
  });
});

// A user joins the game
app.post("/rooms/:roomID/signup", async (req, res) => {
  console.log(req.body.displayName);
  console.log(req.params.roomID);

  const playerInstance = new Player();

  playerInstance.ID = helpers.makeID(6);
  playerInstance.DisplayName = req.body.displayName;
  playerInstance.BoardOrder = helpers.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  playerInstance.WinCondition = false;
  playerInstance.BoardState = [false, false, false, false, false, false, false, false, false];

  // playerInstance.save();

  // Add the new player to the db using Mongoose syntax, not MongoDB.
  const room = await Room.findOne({ ID: req.params.roomID });

  room.Players.push(playerInstance);
  room.save();

  // Save a cookie to remember this player
  res.cookie("playerID", playerInstance.ID, {maxAge: 3600000000}, "/");

  // Redirect them to their personal view.
  res.redirect("/rooms/" + req.params.roomID + "/" + playerInstance.ID);
});

app.get("/rooms/:roomID/:playerID", checkRoomID, async (req, res) => {
  console.log("Made it to the player page");
  console.log(req.cookies.playerID);
  res.render("player");
});

app.get('/error', (req, res) => {
  res.render("error");
});

server.listen(3000, () => {
  console.log('listening on port 3000')
});