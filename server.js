var express = require('express');
var app = express();

var bodyParser = require('body-parser');
var morgan = require('morgan');
// var mongoose = require('mongoose');

var _ = require('underscore');

var jwt = require('jsonwebtoken');
var config = require('./config');
var User = require('./app/models/user');

var sqlite3 = require('sqlite3').verbose()
//var db = new sqlite3.Database(':memory:')
var db = new sqlite3.Database('./lifetracker.db')

app.set("views", __dirname + "/views");
app.set("view engine", "jade");
app.engine('.jade', require('jade').__express);

var port = process.env.PORT || 8080;
// mongoose.connect(config.database);
// app.set('superSecret', config.secret);

app.use(bodyParser.urlencoded({ extended:false }));
app.use(bodyParser.json());

app.use(express.static('resources'))

app.use(morgan('dev'));

app.get('/', function(req, res){
  res.render("index");
});

/*
app.get('/', function(req, res){
  res.send('Hello! This API is at http://localhost:'+ port +'/api');
});
*/

app.get('/metrics', function(req, res){
  getAllMetrics().then(function(metrics){
    res.send(metrics);
  })
});

/* Get recorded instances of a given metric(s), optionally within a given number of days */
app.get('/data', function(req, res){
  data = {};
  getInstancesForRange(req.query.metric.split('|'), req.query.range).then(function(instances){
    _.each(instances, function(instance){
      var name = instance['name'],
          date = instance['date'],
          count = instance['count'];

      if(data[name] === undefined){
        data[name] = {};
      }

      data[name][date] = count;

    });

    res.send(data);
  });
  
});

/*
  {
    "user": "",
    "auth": "",
    'metrics':[{
      'name': '', // String
      'desc': '', // String
      'unit': '', // String
      'type': '', // ['count', 'binary', 'increment']
      'dflt': '', // Float
      'arch': '',  // Date
      'deleted': '', // Bool
      'modified': '' // Timestamp
    }],
    'instances':[{
      'name': '', // String
      'date': '', // Date
      'count': '', // Float
      'details': '', // String
      'deleted': '', // Bool
      'modified': '' // Timestamp
    }]

  }
*/

/* post new metric or instance data to be synced with the server database */
app.post('/submit', function(req, res){
  console.log('post to /submit');
  // console.log(req.body);
  // console.log(req.body.user);
  // console.log(req.body.auth);
  // console.log(req.body.instances);

  // TODO: user auth


  // why is 'unit' and 'type' on instances table?

  // need 'modified_date', 'deleted' on metrics/instances

  // new metrics

  // deleted metrics, how?

  // archived metrics

  // edited metrics

  //
  // handle instances
  //
  _.each(req.body.instances, function(submitInstance){
    // new instances
    // edited instances
    // deleted instances, how?
    //  never delete, just mark 'deleted'
    // console.log("instance:");
    // console.log(instance);

    console.log("submitInstance.name");
    console.log(submitInstance.name);
    console.log(submitInstance.modified);
    //check that metric exists
    // getMetricByName(instance.name).then(function(metric){
    //   console.log("metric");
    //   console.log(metric);
    //   console.log(metric.length);
    //   if(metric.length === 0){
    //     // res.send("metric does not exist: "+ instance.name);
    //     //TODO: maybe add the instance anyway?
    //     console.error("metric does not exist: "+ instance.name);
    //     res.status(204);
    //   }

    // getInstanceById(instance.id).then(function(instance){
    getCurrentInstancesByNameAndDate(submitInstance.name, submitInstance.date).then(function(existInstance){
      console.log("existInstance:");
      console.log(existInstance);
      console.log(existInstance.modified);
      console.log(submitInstance.modified > existInstance.modified);
      if(existInstance === undefined || existInstance.length < 1){ //TODO: correct check?
        // do new instance insert
        console.log("no existing instance found")
      }else {

        if(submitInstance.modified > existInstance[0].modified){
          // do update instance 
          console.log("found earlier instance to update");



        }else{ //existInstance.modified_date > submitInstance.modified_date
          // submit is out of date, don't update
          console.log("found newer existing instance");

        }
      }
    });

  });

  console.log("end of method");
  // res.send();

});










app.get('/setup', function(req, res) {

  // create a sample user
  var nick = new User({ 
    name: 'Nick Cerminara', 
    password: 'password',
    admin: true 
  });

  // save the sample user
  nick.save(function(err) {
    if (err) throw err;

    console.log('User saved successfully');
    res.json({ success: true });
  });
});



// API ROUTES -------------------

// get an instance of the router for api routes
var apiRoutes = express.Router(); 

// route to authenticate a user (POST http://localhost:8080/api/authenticate)
apiRoutes.post('/authenticate', function(req, res) {

  // find the user
  User.findOne({
    name: req.body.name
  }, function(err, user) {

    if (err) throw err;

    if (!user) {
      res.json({ success: false, message: 'Authentication failed. User not found.' });
    } else if (user) {

      // check if password matches
      if (user.password != req.body.password) {
        res.json({ success: false, message: 'Authentication failed. Wrong password.' });
      } else {

        // if user is found and password is right
        // create a token
        var token = jwt.sign(user, app.get('superSecret'), {
          expiresInMinutes: 1440 // expires in 24 hours
        });

        // return the information including token as JSON
        res.json({
          success: true,
          message: 'Enjoy your token!',
          token: token
        });
      }   

    }

  });
});

// route middleware to verify a token
apiRoutes.use(function(req, res, next) {

  // check header or url parameters or post parameters for token
  var token = req.body.token || req.query.token || req.headers['x-access-token'];

  // decode token
  if (token) {

    // verifies secret and checks exp
    jwt.verify(token, app.get('superSecret'), function(err, decoded) {      
      if (err) {
        return res.json({ success: false, message: 'Failed to authenticate token.' });    
      } else {
        // if everything is good, save to request for use in other routes
        req.decoded = decoded;    
        next();
      }
    });

  } else {

    // if there is no token
    // return an error
    return res.status(403).send({ 
        success: false, 
        message: 'No token provided.' 
    });
    
  }
});

// route to show a random message (GET http://localhost:8080/api/)
apiRoutes.get('/', function(req, res) {
  res.json({ message: 'Welcome to the coolest API on earth!' });
});

// route to return all users (GET http://localhost:8080/api/users)
apiRoutes.get('/users', function(req, res) {
  User.find({}, function(err, users) {
    res.json(users);
  });
});   

// apply the routes to our application with the prefix /api
app.use('/api', apiRoutes);

app.listen(port);
console.log('Magic happens at http://localhost:'+ port);


/* db util functions */

var getAllMetrics = function(){
  return new Promise(function(resolve, reject){
    db.all('SELECT name, desc, unit, type, dflt, arch FROM metrics', function(err, rows){
      resolve(rows);
    });
  });
};

var getInstancesForRange = function(metrics, range){
  return new Promise(function(resolve, reject){
    metricsParam = "('" + metrics.join("','") + "')"
  
    var query = 'SELECT name, date, count FROM instances WHERE name in '+ metricsParam;
    if(range != undefined){
      var date = new Date();
      date.setDate(date.getDate() - range);
      query += ' AND date >= "'+ date.toISOString().substring(0, 10) + '"';
    }

    console.log(query);
    
    db.all(query, function (err, rows) {
      resolve(rows);
    });

  });
};

var getMetricByName = function(name){
  return new Promise(function(resolve, reject){
    db.all("SELECT * FROM metrics WHERE name=?", [name], function(err, metrics){
      // console.log("metrics");
      // console.log(metrics);
      resolve(metrics);
    });
  });
}

var getInstanceById = function(id){
  return new Promise(function(resolve, reject){
    db.all("SELECT * FROM instances WHERE id=?", [id], function(err, instance){
      resolve(instance);
    })
  })
}

var getCurrentInstancesByNameAndDate = function(name, date){
  return new Promise(function(resolve, reject){
    db.all("SELECT * FROM instances WHERE name=? AND date=? ORDER BY modified DESC LIMIT 1", [name, date], function(err, instance){
      // console.log(err);
      resolve(instance);
    })
  })
}