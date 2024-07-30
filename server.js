const express = require('express');
const bodyParser = require('body-parser');

// initialize the application
const app = express();

// set the view engine and licate the views folder
app.set('view engine', 'ejs');
app.set('views', (__dirname + '/views'));

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

// root GET request
app.get('/', (req, res) => {
  res.render("home");
});


app.listen(3000, () => console.log('Example app is listening on port 3000.'));