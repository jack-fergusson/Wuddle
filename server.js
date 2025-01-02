require('dotenv').config();

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
  socketRoom: String,
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
  });

  socket.on('player name', (Name) => {
    console.log("Player", Name, "has joined the room.");
  });

  // Register hits FROM the client side
  socket.on('hit', async (playerID, hitIndex, roomID) => {
    console.log("Player", playerID, "has completed square", hitIndex, ". Should save to db and update color.");
    console.log(socket.rooms);

    // THIS IS IT WOOOOO
    io.to(roomID).emit('hit', playerID, hitIndex);

    // Step 1: Get current Players Array
    await Room.findOne({ ID : roomID }).exec()
    .then(async function(room) {
      // console.log(room.Players);

      // Step 2: Update player's BoardState
      room.Players.forEach(player => {
        if (player.ID == playerID) {
          player.BoardState[hitIndex] = true;
        }
      });

      // Step 3: Push back into db
      await Room.updateOne(
        { ID : roomID },
        { Players: room.Players }
      )
      .exec()
      .catch(function(err) {
        console.log(err);
      });
    })
    .catch(function(err) {
      console.log(err);
      alert("Could not query db");
      res.redirect("/error");
    });

  });
});

app.post('/', async (req, res, next) => {
  if (req.cookies.roomID) {
    res.redirect("/rooms/" + req.cookies.roomID + "/boards");
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

    // Route the owner of the room directly to the overview page.
    res.redirect("/rooms/" + roomInstance.ID + "/boards");
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
      alert("Could not query db");
      res.redirect("/error");
    }
  );

  if (roomIDs.includes(req.params.roomID)) {
    // console.log("ROOM ID VERIFIED");
    next();
  }
  else {
    alert("ERROR: No such room: " + req.params.roomID);
    res.redirect("/error");
  }
}

// Check to see if the requested player page matches a player in the DB in the right room
async function checkPlayerID(req, res, next) {
  let playerIDs = [];

  await Room.findOne({ ID: req.params.roomID }, 'Players').exec()
    .then(function(results) {
      results.Players.forEach((player) => {
        playerIDs.push(player.ID);
      }
    )
  });

  if (playerIDs.includes(req.params.playerID)) {
    // Good to go!
    next();
  }
  else {
    console.log("Error. No such player: ", req.params.playerID);
    res.redirect("/error");
  }
}

// Route to the right sub-URL depending on cookie info
app.get("/rooms/:roomID", checkRoomID, async (req, res) => {
  if (req.cookies.playerID) {
    console.log("PLAYER COOKIE EXISTS: ", req.cookies.playerID);
    res.redirect("/rooms/" + req.params.roomID + "/" + req.cookies.playerID);
  }
  else {
    // console.log("NO COOKIE, SIGN UP");
    res.redirect("/rooms/" + req.params.roomID + "/signup");
  }
});

app.get('/rooms/:roomID/boards', checkRoomID, async (req, res) => {

  // Refresh the cookie
  res.cookie("roomID", req.params.roomID, {maxAge: 3600000000}, "/");

  let room;
  // Query this room's squares from database
  await Room.findOne({ ID: req.params.roomID }).exec()
    .then(function(result) {
      room = result;
      console.log(room);
    }
  );

  // Render the room with the found roomID and squares.
  res.render("room", { 
    roomID: req.params.roomID,
    IP: process.env.IP,
    room: room,
  });
}); 

app.get("/rooms/:roomID/signup", checkRoomID, (req, res) => {
  res.render("signup", {
    roomID: req.params.roomID,
  });
});

// A user joins the game
app.post("/rooms/:roomID/signup", async (req, res) => {

  const playerInstance = new Player();

  playerInstance.ID = helpers.makeID(6);
  playerInstance.DisplayName = req.body.displayName;
  playerInstance.BoardOrder = helpers.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  playerInstance.WinCondition = false;
  playerInstance.BoardState = [false, false, false, false, false, false, false, false, false];

  // Add the new player to the db using Mongoose syntax, not MongoDB.
  const room = await Room.findOne({ ID: req.params.roomID });

  room.Players.push(playerInstance);
  room.save();

  // Save a cookie to remember this player
  res.cookie("playerID", playerInstance.ID, {maxAge: 3600000000}, "/");

  // Redirect them to their personal view.
  res.redirect("/rooms/" + req.params.roomID + "/" + playerInstance.ID);
});

app.get("/rooms/:roomID/:playerID", checkRoomID, checkPlayerID, async (req, res) => {
  const room = await Room.findOne({ ID: req.params.roomID });

  console.log("waaaa");
  console.log(room.socketRoom);

  // Search for the requested player in the room's players list
  var currentPlayer;
  room.Players.forEach((player) => {
    if (player.ID == req.params.playerID) {
      currentPlayer = player;
    }
  });

  console.log(currentPlayer);

  // Pass along the player's info to the ejs page
  res.render("player", {
    Events: room.Events,
    Player: currentPlayer,
    roomID: req.params.roomID,
    IP: process.env.IP,
    socketRoom: room.socketRoom
  });
});

app.get('/error', (req, res) => {
  res.render("error");
});

// Home server
server.listen(3000, process.env.IP, () => {
  console.log('listening on port 3000')
});

// Pure localhost
// server.listen(3000, () => {
//   console.log('listening on port 3000')
// });