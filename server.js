const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');

// initialize the application
const app = express();

// set the view engine and licate the views folder
app.set('view engine', 'ejs');
app.set('views', (__dirname + '/views'));

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

// Connection URL
const url = 'mongodb://localhost:27017';
const client = new MongoClient(url);

// Database Name
const dbName = 'BingoDB';

async function main() {
  // Use connect method to connect to the server
  await client.connect();
  console.log('Connected successfully to server');
  const db = client.db(dbName);
  const collection = db.collection('Rooms');

  // the following code examples can be pasted here...
  const insertResult = await collection.insertMany([{ a: 1 }, { a: 2 }, { a: 3 }]);
  console.log('Inserted documents =>', insertResult);

  return 'done.';
}

main()
  .then(console.log)
  .catch(console.error)
  .finally(() => client.close());

// root GET request
app.get('/', (req, res) => {
  res.render("home");
});

let squares = [];
let allowedRoomIDs = [];

app.post('/form', (req, res) => {

  squares = [];

  for (var i = 1; i <= 9; i++) {
    squares.push(req.body[i]);
  }

  allowedRoomIDs.push(req.body.roomID);

  res.redirect("/rooms/" + req.body.roomID);
});

app.get('/rooms/:roomID', (req, res) => {
  console.log(req.body);

  if (allowedRoomIDs.includes(req.params.roomID)) {
    res.render("room", { 
      roomID: req.params.roomID,
      squares: squares
    });
  }
  else {
    console.log("ERROR: No such room");
    res.redirect("/error");
  }
}); 

app.get('/error', (req, res) => {
  res.render("error");
});


app.listen(3000, () => console.log('Example app is listening on port 3000.'));