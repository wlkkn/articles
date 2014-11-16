var express = require('express');
var path = require('path');
var app = express();
var morgan = require('morgan');


app.use(morgan('dev'));
var staticHandler = express.static(__dirname + '/public');
app.use('/static', function(req, res){
  staticHandler(req, res, function(err){
    res.status(404).send('');
  });
});

app.get('/', function(req, res){
  res.send('index');
});

app.listen(8000);
console.log('server listen on 8000');