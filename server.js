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

mongoose.connect('mongodb+srv://jackfergusson03:' + process.env.DBPassword + '@bingo.64i2b.mongodb.net/BingoDB');

const Schema = mongoose.Schema;

const playerSchema = new Schema({
  ID: String,
  DisplayName: String,
  Events: [String],
  BoardState: [Boolean],
  WinCondition: Boolean,
});

const chatSchema = new Schema({
  PlayerID: String,
  PlayerName: String,
  Text: String,
});

const roomSchema = new Schema ({
  Name: String,
  ID: String,
  Chats: [chatSchema],
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

const Chat = mongoose.model(
  "Chat",
  chatSchema
);

// root GET request
app.get('/', (req, res) => {
  res.render("home");
});

app.post('/', (req, res, next) => {
  res.redirect("/rooms/" + req.body.roomID);
});

// root GET request
app.get('/create', (req, res) => {
  res.render("create");
});

// What to do when a client-side socket connects to io
io.on("connection", (socket) => {
  console.log('A user connected');

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });

  socket.on('joinRoom', (roomID) => {
    socket.join(roomID);
    console.log("A user joined room " + roomID);
  });

  socket.on('announcePlayer', (roomID, PlayerID, PlayerName) => {
    console.log("Announced!");
    io.to(roomID).emit('newPlayer', PlayerID, PlayerName);
  });

  socket.on('player name', (Name) => {
    console.log("Player", Name, "has joined the room.");
  });

  // Register hits FROM the client side
  socket.on('hit', async (playerID, hitIndex, roomID) => {
    console.log("Player", playerID, "has completed square", hitIndex, ". Should save to db and update color.");

    // Step 1: Get current Players Array
    await Room.findOne({ ID : roomID }).exec()
    .then(async function(room) {
      // Step 2: Update player's BoardState
      room.Players.forEach(player => {
        if (player.ID == playerID) {
          // Update their boardstate to reflect hit
          player.BoardState[hitIndex] = true;

          console.log(room.Chats);

          // Create an admin chat announcing hit
          const chatInstance = new Chat();
          chatInstance.PlayerID = "0";
          chatInstance.PlayerName = "";
          chatInstance.Text = `${player.DisplayName} has checked off '${player.Events[hitIndex]}'`;

          // update room's chats
          room.Chats.push(chatInstance);

          // send out new chat to room
          io.to(roomID).emit('chat', chatInstance.PlayerID, chatInstance.PlayerName, chatInstance.Text);
          
          // Find out if the player has achieved bingo
          let board = player.BoardState;
          if (board[0] && board[3] && board[6] || board[1] && board[4] && board[7] || board[2] && board[5] && board[8] || board[0] && board[1] && board[2] || board[3] && board[4] && board[5] || board[6] && board[7] && board[8] || board[0] && board[4] && board[8] || board[2] && board[4] && board[6]) {
            // update the player's wincondition
            player.WinCondition = true;
          }

          // THIS IS IT WOOOOO
          io.to(roomID).emit('hit', playerID, hitIndex, player.WinCondition);
        }
      });


      // Step 3: Push back into db
      await Room.updateOne(
        { ID : roomID },
        { Players: room.Players,
          Chats: room.Chats
         }
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

  // Register new chat messages FROM the client side
  socket.on('chat', async (playerID, chatMessage, roomID) => {
    console.log("Player", playerID, "has sent message", chatMessage, ". Should save to db and message board.");
    let sender;

    // Step 1: Get current Players Array
    await Room.findOne({ ID : roomID }).exec()
    .then(async function(room) {
      // Step 2: Update player's BoardState
      room.Players.forEach(player => {
        if (player.ID == playerID) {
          // THIS IS IT WOOOOO
          sender = player;
        }
      });

      const chatInstance = new Chat();
      chatInstance.PlayerID = sender.ID;
      chatInstance.PlayerName = sender.DisplayName;
      chatInstance.Text = chatMessage;

      console.log(chatInstance);

      // add chat to room's chats
      room.Chats.push(chatInstance);
      // console.log(room.Chats);


      // Step 3: Push back into db
      await Room.updateOne(
        { ID : roomID },
        { Chats: room.Chats }
      )
      .exec()
      .then(function() {
        // Let all the chat viewers know to refresh
        io.to(roomID).emit('chat', sender.ID, sender.DisplayName, chatMessage);
      })
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

  socket.on('clear', async (playerID, roomID) => {
    console.log("Player", playerID, "has cleared their board. Should save to db and update color.");
    io.to(roomID).emit('clear', playerID);

    // clear Players Array
    await Room.findOne({ ID : roomID }).exec()
    .then(async function(room) {
      // Step 2: Update player's BoardState
      room.Players.forEach(player => {
        if (player.ID == playerID) {
          for (let i = 0; i < 9; i++) {
            player.BoardState[i] = false;
            player.WinCondition = false;
          }
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
    });
  });
});

app.post('/create', async (req, res, next) => {
  // console.log("Hiiiiiiiii");
  // console.log(req.body.roomName);

  // When form is sent, create a new room instance
  const roomInstance = new Room();

  // Create a new 6-letter ID for this specific room
  roomInstance.ID = helpers.makeID(8);
  roomInstance.Chats = [];

  res.cookie("roomID", roomInstance.roomID, {maxAge: 3600000000}, "/boards");

  let events = [];
  // Get the events from the 8 squares in form
  for (var i = 1; i <= 8; i++) {
    events.push(req.body[i]);
  }
  roomInstance.Events = events;
  roomInstance.Name = req.body.roomName;


  // Save the room with all attributes.
  await roomInstance.save();

  // Route the owner of the room to be signed up to play.
  res.redirect("/rooms/" + roomInstance.ID + "/signup");
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
    console.log("ERROR: No such room: " + req.params.roomID);
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
      });

      if (playerIDs.includes(req.params.playerID)) {
        // Good to go!
        next();
      }
      else {
        console.log("Error. No such player: ", req.params.playerID);
        res.redirect("/error");
      }
  });
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

app.get('/rooms/:roomID/:playerID/boards', checkRoomID, async (req, res) => {
  // Refresh the cookies
  res.cookie("roomID", req.params.roomID, {maxAge: 3600000000}, "/");
  res.cookie("playerID", req.params.playerID, {maxAge: 3600000000}, "/");

  let room;
  // Query this room's squares from database
  await Room.findOne({ ID: req.params.roomID }).exec()
    .then(function(result) {
      room = result;
      // console.log(room);
    }
  );

  // Render the room with the found roomID and squares.
  res.render("room", { 
    PlayerID: req.params.playerID,
    roomID: req.params.roomID,
    IP: process.env.IP,
    room: room,
  });
}); 

app.get('/rooms/:roomID/:playerID/chat', checkRoomID, async (req, res) => {
  let room;
  // Query this room's squares from database
  await Room.findOne({ ID: req.params.roomID }).exec()
    .then(function(result) {
      room = result;
      // console.log(room);
    }
  );

  // Render the room with the found roomID and squares.
  res.render("chat", { 
    PlayerID: req.params.playerID,
    roomID: req.params.roomID,
    IP: process.env.IP,
    room: room,
  });
});

app.get("/rooms/:roomID/signup", checkRoomID, async (req, res) => {
  const room = await Room.findOne({ ID: req.params.roomID });

  res.render("signup", {
    roomID: req.params.roomID,
    room: room,
  });
});

// A user joins the game
app.post("/rooms/:roomID/signup", async (req, res) => {
  const room = await Room.findOne({ ID: req.params.roomID });
  room.Events.push(req.body.event);

  const playerInstance = new Player();

  playerInstance.ID = helpers.makeID(6);
  playerInstance.DisplayName = req.body.displayName;
  playerInstance.Events = helpers.shuffle(room.Events).slice(0, 9);
  playerInstance.WinCondition = false;
  playerInstance.BoardState = [false, false, false, false, false, false, false, false, false];

  // Add the new player to the db using Mongoose syntax, not MongoDB.
  room.Players.push(playerInstance);
  room.save();

  // Save a cookie to remember this player
  res.cookie("playerID", playerInstance.ID, {maxAge: 3600000000}, "/");

  // Redirect them to their personal view.
  res.redirect("/rooms/" + req.params.roomID + "/" + playerInstance.ID);
});

app.get("/rooms/:roomID/:playerID", checkRoomID, checkPlayerID, async (req, res) => {
  const room = await Room.findOne({ ID: req.params.roomID });

  // Search for the requested player in the room's players list
  var currentPlayer;
  room.Players.forEach((player) => {
    if (player.ID == req.params.playerID) {
      currentPlayer = player;
    }
  });

  // console.log(currentPlayer);

  // Pass along the player's info to the ejs page
  res.render("player", {
    Room: room,
    Player: currentPlayer,
    roomID: req.params.roomID,
    IP: process.env.IP,
  });
});

app.get('/error', (req, res) => {
  res.render("error");
});

// Home server
server.listen(3000, process.env.IP, () => {
  console.log('listening on port 3000')
});