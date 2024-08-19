const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const mongoose = require('mongoose');

const helpers = require('./helpers');

// initialize the application
const app = express();

// set the view engine and licate the views folder
app.set('view engine', 'ejs');
app.set('views', (__dirname + '/views'));

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

mongoose.connect('mongodb://localhost:27017/BingoDB');

async function main() {
  

  // const roomInstance = new Room();
  // roomInstance.ID = helpers.makeID(6);
  // console.log(roomInstance);
  // await roomInstance.save();

  // await Room.find({}, 'ID').exec()
  //   .then(function(results) {
  //     console.log(results);

  //     let roomIDs = [];
  //     results.forEach((result) => roomIDs.push(result.ID));

  //     console.log(roomIDs);
  //   })
  //   .catch(function(err) {
  //     console.log(err);
  //   });
}

const Schema = mongoose.Schema;
// const ObjectId = Schema.ObjectId;

const playerSchema = new Schema({
  ID: String,
  DisplayName: String,
  BoardOrder: [Number],
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

// main();


// root GET request
app.get('/', (req, res) => {
  res.render("home");
});

app.post('/form', async (req, res) => {

  // When form is sent, create a new room instance
  const roomInstance = new Room();

  // Create a new 6-letter ID for this specific room
  roomInstance.ID = helpers.makeID(6);

  let events = [];
  // Get the events from the 9 squares in form
  for (var i = 1; i <= 9; i++) {
    events.push(req.body[i]);
  }
  roomInstance.Events = events;

  // Save the room with all attributes.
  await roomInstance.save();

  res.redirect("/rooms/" + roomInstance.ID);
});

app.get('/rooms/:roomID', async (req, res) => {
  let roomIDs = [];

  // Get the IDs of all existing rooms to see if the requested URL is valid
  await Room.find({}, 'ID').exec()
    .then(function(results) {
      console.log(results);

      results.forEach((result) => roomIDs.push(result.ID));
    })
    .catch(function(err) {
      console.log(err);
      res.redirect("/error");
    }
  );

  if (roomIDs.includes(req.params.roomID)) {
    // Query this room's squares from database
    let squares = [];
    await Room.find({ ID: req.params.roomID }, 'Events').exec()
      .then(function(results) {
        squares = results[0].Events;
      }
    );
    console.log(squares);

    // Render the room with the found roomID and squares.
    res.render("room", { 
      roomID: req.params.roomID,
      squares: squares,
    });
  }
  else {
    console.log("ERROR: No such room: " + req.params.roomID);
    res.redirect("/error");
  }
}); 

app.get('/error', (req, res) => {
  res.render("error");
});


app.listen(3000, () => console.log('Example app is listening on port 3000.'));