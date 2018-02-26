var express = require('express');
var app = express();

var bodyParser = require('body-parser');
//var morgan = require('morgan');
// var mongoose = require('mongoose');

var _ = require('underscore');

var jwt = require('jsonwebtoken');
var config = require('./config');
var bcrypt = require('bcrypt');
var bcryptSaltRounds = 12;
//var User = require('./app/models/user');

var sqlite3 = require('sqlite3').verbose()
//var db = new sqlite3.Database(':memory:')
var db = new sqlite3.Database('./lifetracker.db')

app.set("views", __dirname + "/views");
app.set("view engine", "jade");
app.engine('.jade', require('jade').__express);

var port = process.env.PORT || 8080;
// mongoose.connect(config.database);
app.set('superSecret', config.secret);

app.use(bodyParser.urlencoded({ extended:false }));
app.use(bodyParser.json());

app.use(express.static('resources'))

// app.use(morgan('dev'));

app.get('/', function(req, res){
  res.render("index");
});

/*
app.get('/', function(req, res){
  res.send('Hello! This API is at http://localhost:'+ port +'/api');
});
*/

// get an instance of the router for api routes
var apiRoutes = express.Router(); 

apiRoutes.post('/auth', function(req, res){
  // console.log(config);
  // var username = req.body.username;
  // var password = req.body.password;
  // if(username == null || password == null){
    // res.send("null username or password received");
  // }

  getAuthToken(req.body.username, req.body.password).then(function(token){
    res.json({'authtoken': token});
  }).catch(function(error){
    res.send(error);
    //TODO
  });

});


// route middleware to verify a token
// NB: must be after /auth route and before other protected routes
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


apiRoutes.get('/metrics', function(req, res){
  //TODO: this should be the auth user once auth is set up
  //TODO: handle reject()
  getAllMetrics(req.query.user).then(function(metrics){
    res.send(metrics);
  }).catch(function(error){
    //TODO:
  });
});

/* Get recorded instances of a given metric(s), optionally within a given number of days */
apiRoutes.get('/data', function(req, res){
  data = {};
  getInstancesForRange(req.query.user, req.query.metric.split('|'), req.query.range).then(function(instances){
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
  }).catch(function(error){
    //TODO
  });
  
});

/*
{
  content-type: application/json

  raw

	"user": "testuser",
	"auth": "authstring",
	"instances":[{
		"name": "Lunch", 
		"date": "2019-08-01", 
		"count": "1", 
		"details": "Roman's", 
		"deleted": "", 
		"modified": "2019-08-01T06:30:00" 
	}]
}
*/

/* post new metric or instance data to be synced with the server database */
apiRoutes.post('/submit', function(req, res){
  console.log('post to /submit');
  //TODO: validate this.
  var user = req.body.user;
  // console.log(req.body);
  // console.log(req.body.user);
  // console.log(req.body.auth);
  // console.log(req.body.instances);

  // TODO: user auth, middleware from jwt example?
  // is valid user/auth token combo?

  // new metrics

  // deleted metrics, how?

  // archived metrics

  // edited metrics

  //
  // handle metrics
  //
  _.each(req.body.metrics, function(submitMetric){
    console.log("submitMetric.name");
    console.log(submitMetric.name);
    console.log(submitMetric);
    getMetricByName(user, submitMetric.name).then(function(existMetric){

      if(existMetric === undefined || existMetric.length < 1){
        // do new metric insert
        insertMetric(user, submitMetric).then(function(error){
          if(error === undefined){
            res.send(200);
          }else{
            res.send(error);
          }
        });
      }else {
        if(submitMetric.modified > existMetric[0].modified){
          // do update instance 
          updateMetric(user, submitMetric).then(function(error){
            if(error === undefined){
              res.send(200);
            }else{
              res.send(error);
            }
          });  
        }else{ //existMetric.modified_date > submitMetric.modified_date
          // submit is out of date, don't update
          // TODO: what status code here?
          res.send("found newer existing metric")
        }
      }
    });

  });

  //
  // handle instances
  //
  _.each(req.body.instances, function(submitInstance){
    console.log("submitInstance.name");
    console.log(submitInstance.name);
    getCurrentInstancesByNameAndDate(user, submitInstance.name, submitInstance.date).then(function(existInstance){

      if(existInstance === undefined || existInstance.length < 1){
        // do new instance insert
        insertInstance(user, submitInstance).then(function(error){
          if(error === undefined){
            res.send(200);
          }else{
            res.send(error);
          }
        });
      }else {
        if(submitInstance.modified > existInstance[0].modified){
          // do update instance 
          updateInstance(user, submitInstance).then(function(error){
            if(error === undefined){
              res.send(200);
            }else{
              res.send(error);
            }
          });  
        }else{ //existInstance.modified_date > submitInstance.modified_date
          // submit is out of date, don't update
          // TODO: what status code here?
          res.send("found newer existing instance")
        }
      }
    });

  });

  // console.log("end of method");

});









/*
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
*/



// API ROUTES -------------------

/*
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
*/
/*
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
*/
// apply the routes to our application with the prefix /api
app.use('/api', apiRoutes);

app.listen(port);
console.log('Magic happens at http://localhost:'+ port);




/* ***************** */
/* db util functions */
/* ***************** */

/* auth functions */
var getAuthToken = function(username, password){
  // console.log(username);
  // console.log(password);
  return new Promise(function(resolve, reject){
    db.all('SELECT password, disabled FROM users where username=?', [username], function(err, rows){
      // console.log(err);
      // console.log(rows);
      if(err !== null || rows === null || rows.length < 1){
        reject('user not found');
      }else{
        var user = rows[0];
        // bcrypt.hash(password, bcryptSaltRounds, function(err, hash){
          // console.log(err);
          // console.log(hash);
        // })
        bcrypt.compare(password, user.password, function(err, res) {
          // console.log('password compare');
          // console.log(err);
          // console.log(res);
          // res == true
          if(res === true){
            payload = { disabled: user.diabled };
            var token = jwt.sign(payload, app.get('superSecret'), {
              expiresIn: 86400 // expires in 24 hours
            });
            resolve(token);
          }else{
            reject('password incorrect');
          }
        });
      }
    });
    
  });
};



/* get functions */

var getAllMetrics = function(user){
  return new Promise(function(resolve, reject){
    db.all('SELECT name, desc, unit, type, dflt, arch FROM metrics where user=?', [user], function(err, rows){
      resolve(rows);
    });
  });
};

var getInstancesForRange = function(user, metrics, range){
  return new Promise(function(resolve, reject){
    metricsParam = "('" + metrics.join("','") + "')"
  
    var query = 'SELECT name, date, count FROM instances WHERE user=? AND name in '+ metricsParam;
    if(range != undefined){
      var date = new Date();
      date.setDate(date.getDate() - range);
      query += ' AND date >= "'+ date.toISOString().substring(0, 10) + '"';
    }

    console.log(query);
    
    db.all(query, [user], function (err, rows) {
      resolve(rows);
    });

  });
};

var getMetricByName = function(user, name){
  return new Promise(function(resolve, reject){
    db.all("SELECT * FROM metrics WHERE user=? AND name=?", [user, name], function(err, metrics){
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

var getCurrentInstancesByNameAndDate = function(user, name, date){
  return new Promise(function(resolve, reject){
    db.all("SELECT * FROM instances WHERE user=? AND name=? AND date=? ORDER BY modified DESC LIMIT 1", [user, name, date], function(err, instance){
      // console.log(err);
      resolve(instance);
    })
  })
}

/* insert functions */

var insertInstance = function(user, instance){
  return new Promise(function(resolve, reject){
    db.run("INSERT INTO instances (user, name, date, count, details, deleted, modified) VALUES($user, $name, $date, $count, $details, $deleted, $modified)", {
      $user: user,
      $name: instance.name,
      $date: instance.date, 
      $count: instance.count, 
      $details: instance.details, 
      $deleted: instance.deleted, 
      $modified: instance.modified
    }, function(error){
      if(error != null){
        reject(error);
      }else{
        resolve();
      }
    });
  });
}

var insertMetric = function(user, metric){
  return new Promise(function(resolve, reject){
    db.run("INSERT INTO metrics (user, name, desc, unit, type, dflt, deleted, arch, modified) VALUES($user, $name, $desc, $unit, $type, $dflt, $deleted, $arch, $modified)", {
      $user: user,
      $name: metric.name,
      $desc: metric.desc, 
      $unit: metric.unit, 
      $type: metric.type, 
      $dflt: metric.dflt,
      $deleted: metric.deleted, 
      $arch: metric.arch,
      $modified: metric.modified
    }, function(error){
      if(error != null){
        reject(error);
      }else{
        resolve();
      }
    });
  })
}

/* update functions */

var updateInstance = function(user, instance){
  return new Promise(function(resolve, reject){
    db.run("UPDATE instances SET count=$count, details=$details, deleted=$deleted, modified=$modified WHERE user = $user AND name = $name AND date = $date",{
      $count: instance.count,
      $details: instance.details,
      $deleted: instance.deleted,
      $modified: instance.modified,
      $user: user,
      $name: instance.name,
      $date: instance.date
    }, function(error){
      if(error != null){
        reject(error);
      }else{
        resolve();
      }
    });
  });
}

var updateMetric = function(user, metric){
  return new Promise(function(resolve, reject){
    db.run("UPDATE metrics SET desc=$desc, unit=$unit, type=$type, dflt=$dflt, deleted=$deleted, arch=$arch, modified=$modified WHERE user = $user AND name = $name",{
      $desc: metric.desc,
      $unit: metric.unit,
      $type: metric.type,
      $dflt: metric.dflt,
      $deleted: metric.deleted,
      $arch: metric.arch,
      $modified: metric.modified,
      $user: user,
      $name: metric.name
    }, function(error){
      if(error != null){
        reject(error);
      }else{
        resolve();
      }
    });
  });
}