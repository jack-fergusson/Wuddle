import 'dotenv/config'

import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import herokuSSLRedirect from 'heroku-ssl-redirect';
const sslRedirect = herokuSSLRedirect.default
import express from 'express';

import { Filter } from 'bad-words'
const filter = new Filter();

const port = process.env.PORT || 3000;

import helpers from './helpers.js';

// initialize the application
const app = express();
import * as http from 'http';
const server = http.createServer(app);
import { Server } from "socket.io";
const io = new Server(server, {
  connectionStateRecovery: {}
});

const __dirname = import.meta.dirname;

// set the view engine and licate the views folder
app.set('view engine', 'ejs');
app.set('views', (__dirname + '/views'));

const exampleIDs = ["T8BSP5FE", "G4UNKTTZ", "3W2VGFK9"];

app.use(express.static(__dirname + '/public'));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());
app.use(sslRedirect());

const uri = process.env.MONGODB_URI;
mongoose.connect(uri);

const Schema = mongoose.Schema;

const IdStorageSchema = new Schema({
  RoomIds: [String],
  PlayerIds: [String],
})

const playerSchema = new Schema({
  ID: String,
  DisplayName: String,
  Events: [String],
  BoardState: [Boolean],
  WinCondition: Boolean,
  NumWins: Number,
});

const chatSchema = new Schema({
  PlayerID: String,
  PlayerName: String,
  Text: String,
  DateCreated: {type: Date, default: Date.now},
});

const roomSchema = new Schema ({
  Name: String,
  ID: String,
  Chats: [chatSchema],
  BoardSize: Number,
  Events: [String],
  Players: [playerSchema],
  CreatorID: String,
  TemplateRoomID: { type: String, default: 0 }, // Original board from which this one was copied if applicable
  DateCreated: {type: Date, default: Date.now},
});

const IdStorage = mongoose.model(
    "IdStorage",
    IdStorageSchema
);

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
app.get('/', async (req, res) => {
  if (req.cookies.playerID) {
    console.log("UserID Cookie!");
    await Room.find().exec()
    .then(async function(rooms) {
      let playerRooms = [];

      rooms.forEach(room => {
        room.Players.forEach(player => {
          if (player.ID == req.cookies.playerID) {
            playerRooms.push({
              ID: room.ID,
              Name: room.Name
            });
          }
        });

        // room.TemplateRoomID = "0";
        // room.DateCreated = Date.now();
        // room.Chats.forEach(chat => {
        //   chat.DateCreated = Date.now();
        // });
        // room.save();
      });

      if (playerRooms.length == 0) {
        res.clearCookie("playerID");
        res.render("home", {
          rooms: playerRooms,
          signedIn: false,
        });
      } 
      else {
        res.render("home", {
          rooms: playerRooms,
          signedIn: true,
        });
      }
    });
  } else {
    res.render("home", {
      rooms: [],
      signedIn: false,
    });
  }
});

// Route to user-entered room
app.post('/', (req, res, next) => {
  let roomID = req.body.roomID.toUpperCase();
  res.redirect("/rooms/" + roomID);
});

app.post('/sign-in', (req, res) => {
  res.cookie("playerID", req.body.playerID.toUpperCase(), {maxAge: 3600000000}, "/");
  res.redirect("/");
});

app.get('/info', (req, res) => {
  res.render("info");
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

          // console.log(room.Chats);

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
          if (room.BoardSize == 3) {
            if (board[0] && board[3] && board[6] || board[1] && board[4] && board[7] || board[2] && board[5] && board[8] || board[0] && board[1] && board[2] || board[3] && board[4] && board[5] || board[6] && board[7] && board[8] || board[0] && board[4] && board[8] || board[2] && board[4] && board[6]) {
              // update the player's wincondition
              player.WinCondition = true;
            }
          } else if (room.BoardSize == 4) {
            if (board[0] && board[4] && board[8] && board[12] || board[1] && board[5] && board[9] && board[13] || board[2] && board[6] && board[10] && board[14] || board[3] && board[7] && board[11] && board [15] || board[0] && board[1] && board[2] && board[3] || board[4] && board[5] && board[6] && board[7] || board[8] && board[9] && board[10] && board[11] || board[12] && board[13] && board[14] && board[15] || board[0] && board[5] && board[10] && board[15] || board[3] && board[6] && board[9] && board[12]) {
              // update the player's wincondition
              player.WinCondition = true;
            }
          } else if (room.BoardSize == 5) {
            if (board[0] && board[5] && board[10] && board[15] && board[20] || board[1] && board[6] && board[11] && board[16] && board[21] || board[2] && board[7] && board[12] && board[17] && board[22] || board[3] && board[8] && board[13] && board [18] && board[23] || board[4] && board[9] && board[14] && board [19] && board[24] || board[0] && board[1] && board[2] && board[3] && board[4] || board[5] && board[6] && board[7] && board[8] && board[9] || board[10] && board[11] && board[12] && board[13] && board[14] || board[15] && board[16] && board[17] && board[18] && board[19] || board[20] && board[21] && board[22] && board[23] && board[24] || board[0] && board[6] && board[12] && board[18] && board[24] || board[4] && board[8] && board[12] && board[16] && board[20]) {
              // update the player's wincondition
              player.WinCondition = true;
            }
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
      console.log("Could not query db");
      res.redirect("/error");
    });

  });

  // Register new chat messages FROM the client side
  socket.on('chat', async (playerID, chatMessage, roomID) => {
    chatMessage = filter.clean(chatMessage);

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
      console.log("Could not query db");
      res.redirect("/error");
    });

  });

  // User requested a new board
  socket.on('refresh', async (playerID, roomID) => {
    console.log("Player", playerID, "has requested a new board. Should update DB");
    let sender;

    // Step 1: Get current Players Array
    await Room.findOne({ ID : roomID }).exec()
    .then(async function(room) {
      // Step 2: Update player's BoardState
      room.Players.forEach(player => {
        if (player.ID == playerID) {
          if (room.BoardSize == 3) {
            let tempEvents = room.Events.slice();
            player.Events = helpers.shuffle(tempEvents).slice(0, 9);
            // player.BoardState = [false, false, false, false, false, false, false, false, false];
            player.BoardState = Array(9).fill(false);
          } else if (room.BoardSize == 4) {
            let tempEvents = room.Events.slice();
            player.Events = helpers.shuffle(tempEvents).slice(0, 16);
            // player.BoardState = [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false];
            player.BoardState = Array(16).fill(false);
          } else if (room.BoardSize == 5) {
            let tempEvents = room.Events.slice();
            player.Events = helpers.shuffle(tempEvents).slice(0, 25);
            player.BoardState = Array(25).fill(false);
          }
          player.WinCondition = false;
          player.NumWins += 1;
          sender = player;

          // Create an admin chat announcing refreh
          const chatInstance = new Chat();
          chatInstance.PlayerID = "0";
          chatInstance.PlayerName = "";
          chatInstance.Text = `${player.DisplayName} has finished a line & refreshed their board.`;

          // update room's chats
          room.Chats.push(chatInstance);
        }
      });


      // Step 3: Push back into db
      await Room.updateOne(
        { ID : roomID },
        { Players: room.Players },
      )
      .exec()
      .then(function() {
        // Let chat know they refreshed
        io.to(roomID).emit('refresh', sender.DisplayName, sender.ID, sender.NumWins);
      })
      .catch(function(err) {
        console.log(err);
      });

      // Step 4: Push chat into db
      await Room.updateOne(
        { ID : roomID },
        { Chats: room.Chats },
      )
      .exec()
      .then(function() {

      })
      .catch(function(err) {
        console.log(err);
      });
    })
    .catch(function(err) {
      console.log(err);
      console.log("Could not query db");
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
          player.WinCondition = false;
          if (room.BoardSize == 3) {
            for (let i = 0; i < 9; i++) {
              player.BoardState[i] = false;
            }
          } else if (room.BoardSize == 4) {
            for (let i = 0; i < 16; i++) {
              player.BoardState[i] = false;
            }
          } else if (room.BoardSize == 5) {
            for (let i = 0; i < 25; i++) {
              player.BoardState[i] = false;
            }
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

  socket.on('newEvent', async(roomID, eventText) => {
    eventText = filter.clean(eventText);

    console.log(`New Event: ${eventText}`);

    if (!eventText.includes('*') && !exampleIDs.includes(roomID)) {
      await Room.findOne({ ID : roomID }).exec()
      .then(async function(room) {
        room.Events.push(eventText);

        await Room.updateOne(
          { ID : roomID },
          { Events: room.Events }
        )
        .exec()
        .then(function() {
          io.to(roomID).emit('addEvent', eventText);
        })
        .catch(function(err) {
          console.log(err);
        });
      });
    }
  });

  socket.on('deleteEvent', async (roomID, eventIndex) => {
    await Room.findOne({ ID : roomID }).exec()
    .then(async function(room) {
      room.Events.splice(eventIndex, 1);

      await Room.updateOne(
        { ID : roomID },
        { Events: room.Events }
      )
      .exec()
      .then(function() {
        io.to(roomID).emit('deleteEvent', eventIndex);
      })
      .catch(function(err) {
        console.log(err);
      });
    });
  });
});

app.get('/copy/:roomID', async (req, res) => {
  await Room.findOne({ ID : req.params.roomID }).exec()
  .then(async function(room) {
    try {
      let IDs = await IdStorage.findOne({ ID : "1" });
      let roomCode = helpers.makeUniqueID(8, IDs.RoomIds);
      IDs.RoomIds.push(roomCode);
      IDs.save();

      let alreadyCopied = false;

      // See if this user has already made a copy of this room
      if (req.cookies.playerID) {
        console.log("HERE!");
        await Room.find({ TemplateRoomID : room.ID }).exec()
        .then(async function(rooms) {
          rooms.forEach(room => {
            console.log(room.Name);
            if (room.CreatorID == req.cookies.playerID && room.Players.length > 0) {
              // This player has made a copy of this room before!
              console.log("They have already made a copy!");
              alreadyCopied = true;
            }
          });

          res.render("create", {
            roomID: roomCode,
            roomName: room.Name,
            roomEvents: room.Events,
            roomBoardSize: room.BoardSize,
            TemplateRoomID: room.ID,
            AlreadyCopied: alreadyCopied,
          });
        });
      }
      else {
        res.render("create", {
          roomID: roomCode,
          roomName: room.Name,
          roomEvents: room.Events,
          roomBoardSize: room.BoardSize,
          TemplateRoomID: room.ID,
          AlreadyCopied: alreadyCopied,
        });
      }
    } catch (error) {
      console.error(error);

      throw error;
    }
  });
});

app.get('/create', async (req, res) => {
  try {
    let IDs = await IdStorage.findOne({ ID : "1" });
    let roomCode = helpers.makeUniqueID(8, IDs.RoomIds);
    IDs.RoomIds.push(roomCode);
    IDs.save();

    res.render("create", {
      // Default blank room
      roomID: roomCode,
      roomName: "",
      roomEvents: [],
      roomBoardSize: "3",
      TemplateRoomID: "0",
      AlreadyCopied: false,
    });
  } catch (error) {
    console.error(error);

    throw error;
  }
});

app.post('/create', async (req, res, next) => {
  // When form is sent, create a new room instance
  const roomInstance = new Room();

  roomInstance.ID = req.body.roomID;
  roomInstance.TemplateRoomID = req.body.TemplateRoomID;
  roomInstance.Chats = [];

  let events = req.body.events.split(/\r?\n/);
  let processedEvents = [];
  console.log(events);
  for (let i = 0; i < events.length; i++) {
    if (events[i].length > 0) {
      // Filter out bad words and truncate to 43 chars
      processedEvents.push(filter.clean(events[i].substring(0, 43)));
    }
  }
  
  roomInstance.Events = processedEvents;
  roomInstance.Name = filter.clean(req.body.roomName);
  roomInstance.BoardSize = parseInt(req.body.boardSize);

  // If the creator already has an ID, snag it
  if (req.cookies.playerID) {
    roomInstance.CreatorID = req.cookies.playerID;
  }
  else {
    // else give them an ID
    console.log("GENERATING CREATOR'S ID");
    // var ID = helpers.makeID(8);
    try {
      let IDs = await IdStorage.findOne({ ID : "1" });
      let playerCode = helpers.makeUniqueID(8, IDs.PlayerIds);
      IDs.PlayerIds.push(playerCode);
      IDs.save();

      // Store cookie
      res.cookie("playerID", playerCode, {maxAge: 3600000000}, "/");

      roomInstance.CreatorID = playerCode;

    } catch (error) {
      console.error(error);

      throw error;
    }
  }

  const playerInstance = new Player();

  playerInstance.ID = roomInstance.CreatorID;

  playerInstance.DisplayName = filter.clean(req.body.displayName);
  playerInstance.WinCondition = false;
  playerInstance.NumWins = 0;

  if (roomInstance.BoardSize == 3) {
    let tempEvents = roomInstance.Events.slice();
    playerInstance.Events = helpers.shuffle(tempEvents).slice(0, 9);
    playerInstance.BoardState = [false, false, false, false, false, false, false, false, false];
  } 
  else if (roomInstance.BoardSize == 4) {
    console.log("Big board!");
    let tempEvents = roomInstance.Events.slice();
    playerInstance.Events = helpers.shuffle(tempEvents).slice(0, 16);
    playerInstance.BoardState = [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false];
  }
  else if (roomInstance.BoardSize == 5) {
    console.log("5x5 board!");
    let tempEvents = roomInstance.Events.slice();
    playerInstance.Events = helpers.shuffle(tempEvents).slice(0, 25);
    playerInstance.BoardState = Array(25).fill(false);
  }

  // Add the new player to the db using Mongoose syntax, not MongoDB.
  roomInstance.Players.push(playerInstance);

  let chatInstance = new Chat();
  chatInstance.PlayerID = "0";
  chatInstance.PlayerName = "";
  chatInstance.Text = `${req.body.displayName} has joined the room!`;

  roomInstance.Chats.push(chatInstance);


  // Save the room with all attributes.
  await roomInstance.save();

  // Route the owner of the room to their board
  res.redirect("/rooms/" + roomInstance.ID + "/my-board");
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
      console.log("Could not query db");
      res.render("error", {
        msg: "Could not query db"
      });
      res.end();
    }
  );

  if (roomIDs.includes(req.params.roomID)) {
    console.log("ROOM ID VERIFIED");
    next();
  }
  else {
    console.log("ERROR: No such room: " + req.params.roomID);
    var string = ('Invalid Room ID: ' + req.params.roomID);
    res.render("error", {
      msg: string
    });
    res.end();
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

      if (playerIDs.includes(req.cookies.playerID)) {
        // Refresh the cookie
        res.cookie("playerID", req.cookies.playerID, {maxAge: 3600000000}, "/");
        // Good to go!
        next();
      }
      else {
        console.log("Error. No such player: ", req.cookies.playerID);
        var string = ('Invalid Player ID: ' + req.cookies.playerID);
        res.render("error", {
          msg: string
        });
        res.end();
      }
  });
}

// Route to the right sub-URL depending on cookie info
app.get("/rooms/:roomID", checkRoomID, async (req, res) => {
  if (req.cookies.playerID) {
    console.log("PLAYER COOKIE EXISTS: ", req.cookies.playerID + " Check if in room");
    
    let playerIDs = [];
    let flag = 0;
    
    await Room.findOne({ ID: req.params.roomID }, 'Players').exec()
    .then(function(results) { // check if they've been to this room before
      results.Players.forEach((player) => {
        playerIDs.push(player.ID);
      });

      if (playerIDs.includes(req.cookies.playerID)) {
        // They have been here before!
        console.log("They have been here before!");
        flag = 1;
        res.redirect("/rooms/" + req.params.roomID + "/my-board");
      }
    });

    // Flag system ensure res is not sent twice.
    if (flag == 0) {
      // Sign up! Never been here.
      res.redirect("/rooms/" + req.params.roomID + "/signup");
    }
  }
  else {
    console.log("NO COOKIE, SIGN UP");
    res.redirect("/rooms/" + req.params.roomID + "/signup");
  }
});

app.get('/rooms/:roomID/boards', checkRoomID, checkPlayerID, async (req, res) => {
  // If you get tot his point, you by definition have a playerID cookie

  // Refresh the cookie
  res.cookie("playerID", req.cookies.playerID, {maxAge: 3600000000}, "/");

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
    PlayerID: req.cookies.playerID,
    roomID: req.params.roomID,
    IP: process.env.IP,
    room: room,
  });
}); 

app.get('/rooms/:roomID/chat', checkRoomID, checkPlayerID, async (req, res) => {
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
    PlayerID: req.cookies.playerID,
    roomID: req.params.roomID,
    IP: process.env.IP,
    room: room,
  });
});

app.get("/rooms/:roomID/signup", checkRoomID, async (req, res) => {
  const room = await Room.findOne({ ID: req.params.roomID });

  if (req.cookies.playerID) {
    let playerID = req.cookies.playerID;
    console.log("PLAYER COOKIE EXISTS: ", playerID + " check if belongs to room");

    room.Players.forEach((player) => {
      if (player.ID == playerID) {
        // This person has been here before!
        res.redirect("/rooms/" + req.params.roomID + "/my-board");
      }
    });
  }

  // Player is new to this room
  res.render("signup", {
    roomID: req.params.roomID,
    room: room,
  });
});

// A user joins the game
app.post("/rooms/:roomID/signup", async (req, res) => {
  const room = await Room.findOne({ ID: req.params.roomID });
  
  // if (req.body.event != "") {
  //   room.Events.push(filter.clean(req.body.event));
  // }

  const playerInstance = new Player();

  if (req.cookies.playerID) {
    // Player has played a game before, has an ID
    playerInstance.ID = req.cookies.playerID;
  }
  else {
    // This is this user's first game
    console.log("GENERATING NEW ID");
    try {
      let IDs = await IdStorage.findOne({ ID : "1" });
      let playerCode = helpers.makeUniqueID(8, IDs.PlayerIds);
      IDs.PlayerIds.push(playerCode);
      IDs.save();

      playerInstance.ID = playerCode;

    } catch (error) {
      console.error(error);

      throw error;
    }
  }
  playerInstance.DisplayName = filter.clean(req.body.displayName);
  playerInstance.WinCondition = false;
  playerInstance.NumWins = 0;

  if (room.BoardSize == 3) {
    let tempEvents = room.Events.slice();
    playerInstance.Events = helpers.shuffle(tempEvents).slice(0, 9);
    playerInstance.BoardState = [false, false, false, false, false, false, false, false, false];
  } 
  else if (room.BoardSize == 4) {
    console.log("Big board!");
    let tempEvents = room.Events.slice();
    playerInstance.Events = helpers.shuffle(tempEvents).slice(0, 16);
    playerInstance.BoardState = [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false];
  }
  else if (room.BoardSize == 5) {
    console.log("5x5 board!");
    let tempEvents = room.Events.slice();
    playerInstance.Events = helpers.shuffle(tempEvents).slice(0, 25);
    playerInstance.BoardState = Array(25).fill(false);
  }

  // Add the new player to the db using Mongoose syntax, not MongoDB.
  room.Players.push(playerInstance);

  let chatInstance = new Chat();
  chatInstance.PlayerID = "0";
  chatInstance.PlayerName = "";
  chatInstance.Text = `${req.body.displayName} has joined the room!`;

  room.Chats.push(chatInstance);

  room.save();

  // Announce to the room that a brand new player has joined
  io.to(room.ID).emit('newPlayer', playerInstance.ID, playerInstance.DisplayName);

  // Save a cookie to remember this player / refresh cookie if already exists
  res.cookie("playerID", playerInstance.ID, {maxAge: 3600000000}, "/");

  // Redirect them to their personal view.
  res.redirect("/rooms/" + req.params.roomID + "/my-board");
});

app.get("/rooms/:roomID/my-board", checkRoomID, checkPlayerID, async (req, res) => {
  console.log("Almost made it!");

  await Room.findOne({ ID : req.params.roomID }).exec()
  .then(async function(room) {
    // Search for the requested player in the room's players list
    var currentPlayer;
    room.Players.forEach((player) => {
      if (player.ID == req.cookies.playerID) {
        currentPlayer = player;
      }
    });

    // How many events you need for a full BINGO board
    let neededEvents = (room.BoardSize * room.BoardSize);
    if (currentPlayer.Events.length < neededEvents && room.Events.length >= neededEvents) {
      // This user has not been given enough events
      // And now there are enough events to give them
      // Therefore create new events array for player
      let tempEvents = room.Events.slice();
      currentPlayer.Events = helpers.shuffle(tempEvents).slice(0, neededEvents);
      console.log("AHHHHHHH");
      room.save();
    }

    // Pass along the player's info to the ejs page
    res.render("player", {
      Room: room,
      Player: currentPlayer,
      roomID: req.params.roomID,
      IP: process.env.IP,
    });
  });
});

app.get("/examples", async (req, res) => {
  let exampleRooms = [];

  exampleIDs.forEach(async roomID => {
    await Room.findOne({"ID" : roomID}).exec()
    .then(function(room) {
      // console.log(room.Name);
      exampleRooms.push(room);

      if (exampleRooms.length == exampleIDs.length) {
        exampleRooms.sort();
        res.render("examples", {
          Rooms: exampleRooms,
        });
      }
    });
  });
})


app.get('/error', (req, res) => {
  var errorString = req.query.msg;
  console.log(errorString);

  console.log("Player Cookie: " + req.cookies.playerID);

  res.render("error", {
    errorString: errorString
  });
});

// Allow robots.txt file to be accessed by googlebot
// necessary for hosting online
app.get("/robots.txt", function(req, res){
  res.sendFile(__dirname + "/robots.txt");
});

// Heroku
// server.listen(port, () => {
//   console.log(`listening on port ${port}`)
// });

// Elsewhere
server.listen(port, process.env.IP, () => {
  console.log(`listening on port ${port}`)
});
