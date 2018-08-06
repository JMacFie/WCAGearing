const { Device, validate } = require('../models/device');
const { Power } = require('../models/power');
const mongoose = require('mongoose');
const express = require('express');
const router = express.Router();
var powerArray = [];


router.get('/', async (req, res) => {
  console.log(req.query.id);
  if (req.query.id) {
    var deString = (req.query.id).replace(/\"/g, "");
    deString = deString.replace(/\'/g, "");
    const devices = await Device.find({ ip: { $in: [deString, "OR WHATEVER"] } });
    res.send(devices);
  }
  else {
    const devices = await Device.find().sort('ip');
    res.send(devices);
  }
});


function incrementFunc(data) {
  var canReturn = false;
  var dataArray = data.filter(obj => {
    return obj.status === '0'
  });


  if (dataArray.length >= 1) {
    var pythonMessage = 'Null';
    const PythonShell = require('python-shell');
    var pyshell = new PythonShell('pyScripts/wemo_setOn_single.py');
    pyshell.send(JSON.stringify([(dataArray[0].ip)]));
    pyshell.on('message', function (message) {
      pythonMessage = message;
    });

    // end the input stream and allow the process to exit
    pyshell.end(function (err) {
      if (err) {
        throw err;
      }
      if (pythonMessage != undefined) {
        if ((pythonMessage.charAt(0) == '1' && pythonMessage.charAt(1) == '|') || pythonMessage.charAt(0) == '0' || (pythonMessage.charAt(0) == '8' && pythonMessage.charAt(1) == '|')) {
          if (pythonMessage.charAt(0) == '0') {
            dataArray.splice(0, 1);
            decrementFunc(dataArray);
          }
          if (pythonMessage.charAt(0) == '1' || pythonMessage.charAt(0) == '8') {
            Device.findOne({ ip: `${dataArray[0].ip}` }, function (err, doc) {
              doc.status = '1';
              doc.save();
            });
            canReturn = true;
          }
        }
      }
    });
  }
  if (dataArray.length < 1) {
    return 'noMore';
  }
  else {
    return 'on';
  }
}



function decrementFunc(data) {
  var canReturn = false;
  var dataArray = data.filter(obj => {
    return obj.status === '1'
  });


  if (dataArray.length >= 1) {
    var pythonMessage = 'Null';
    const PythonShell = require('python-shell');
    var pyshell = new PythonShell('pyScripts/wemo_setOff_single.py');
    pyshell.send(JSON.stringify([(dataArray[0].ip)]));
    pyshell.on('message', function (message) {
      pythonMessage = message;
    });

    // end the input stream and allow the process to exit
    pyshell.end(function (err) {
      if (err) {
        throw err;
      }

      if (pythonMessage != undefined) {
        if ((pythonMessage.charAt(0) == '1' && pythonMessage.charAt(1) == '|') || pythonMessage.charAt(0) == '0') {
          console.log('TEST: ' + pythonMessage);
          if (pythonMessage.charAt(0) == '1') {
            dataArray.splice(0, 1);
            decrementFunc(dataArray);
          }

          if (pythonMessage.charAt(0) == '0') {
            console.log("OBJECT: " + dataArray[0]);
            Device.findOne({ ip: `${dataArray[0].ip}` }, function (err, doc) {
              doc.status = '0';
              doc.save();
            });
            canReturn = true;
          }
        }
      }
    });
  }

  if (dataArray.length < 1) {
    return 'noMore';
  }
  else {
    return 'off';
  }
}


router.post('/toggle', function (req, res) {
  var Message = "No Message";
  const PythonShell = require('python-shell');
  var pyshell = new PythonShell('pyScripts/wemo_toggle_single.py');
  pyshell.send(JSON.stringify([req.body.ip]));

  pyshell.on('message', function (message) {
    Message = message;
  });

  // end the input stream and allow the process to exit
  pyshell.end(function (err) {
    if (err) {
      throw err;
    };
    if (Message != 'No Message') {
      Device.findOne({ ip: `${req.body.ip}` }, function (err, doc) {
        doc.status = Message;
        doc.save();
      });
    }
    res.send(JSON.stringify([Message]));
  });
});

router.post('/decrease', async (req, res) => {
  var devices = await Device.find().sort('priority');
  var priorityLevels = new Object();
  priorityLevels.highest = 0;
  priorityLevels.lowest = 0;
  var intPriority = [];
  var newItem;
  var hasRemoved = false;

  for (var i = 0; i < devices.length; i++) {
    intPriority.push(parseInt((devices[i]).priority));
  }

  priorityLevels.lowest = Math.max.apply(Math, intPriority);
  priorityLevels.highest = Math.min.apply(Math, intPriority);
  devices = await Device.find().sort('priority');
  var pythonReturn = decrementFunc(devices);

  if (pythonReturn == 'off') {
    res.send(JSON.stringify(["wemo with highest priority turned off"]));
  }
  if (pythonReturn == 'noMore') {
    res.send(JSON.stringify(["no more wemos to turn off"]));
  }
});


router.post('/increase', async (req, res) => {
  var devices = await Device.find().sort({ 'priority': -1 });
  var priorityLevels = new Object();
  priorityLevels.highest = 0;
  priorityLevels.lowest = 0;
  var intPriority = [];
  var newItem;
  var hasRemoved = false;

  for (var i = 0; i < devices.length; i++) {
    intPriority.push(parseInt((devices[i]).priority));
  }
  priorityLevels.lowest = Math.max.apply(Math, intPriority);
  priorityLevels.highest = Math.min.apply(Math, intPriority);
  var pythonReturn = incrementFunc(devices);
  if (pythonReturn == 'on') {
    res.send(JSON.stringify(["wemo with lowest priority turned on"]));
  }
  if (pythonReturn == 'noMore') {
    res.send(JSON.stringify(["no more wemos to turn on"]));
  }
});

router.post('/', async (req, res) => {
  var name = 'Null';
  var phase = 'Null';
  var room = 'Null';
  var location = 'Null';
  var level = 'Null';
  var position = 'Null';
  var item = 'Null';
  var type = 'Null';
  var priority = 'Null';
  var status = 'Null';
  const { error } = validate(req.body);
  if (error) return res.status(400).send(error.details[0].message);

  //PYTHON - START 
  const PythonShell = require('python-shell');
  var pyshell = new PythonShell('pyScripts/wemo_getName_single.py');
  pyshell.send(JSON.stringify([req.body.ip]));
  pyshell.on('message', function (message) {
    if (message != undefined) {
      var messageArray = message.split(/(\s+)/);
      if ((messageArray[0]).length == 8) {
        console.log(messageArray[0] + " name given from WeMo. Status: " + messageArray[2]);
        name = messageArray[0];
        status = messageArray[2];
        return;
      }
    }
  });

  // end the input stream and allow the process to exit
  pyshell.end(function (err) {
    if (err) {
      throw err;
    };
    if (name != 'Null' || name != undefined) {
      phase = name.charAt(0);
      room = name.charAt(1);
      location = name.charAt(2);
      level = name.charAt(3);
      position = name.charAt(4);
      item = name.charAt(5);
      type = name.charAt(6);
      priority = name.charAt(7);
    }

    if (status > 1) {
      status = 1;
    }

    console.log('finished');
    let device = new Device({
      ip: req.body.ip,
      name: name,
      phase: phase,
      room: room,
      location: location,
      level: level,
      position: position,
      item: item,
      type: type,
      priority: priority,
      status: status
    });
    device = device.save();
    res.send(JSON.stringify(device));
  });
});






function powerFunc(ip) {
  var pythonMessage = 'Null';
  const PythonShell = require('python-shell');
  var pyshell = new PythonShell('pyScripts/wemo_getPower_single.py');
  pyshell.send(JSON.stringify([ip]));
  pyshell.on('message', function (message) {
    pythonMessage = message;
    console.log(pythonMessage);
  });

  // end the input stream and allow the process to exit
  pyshell.end(function (err) {
    if (err) {
      throw err;
    }
    if (pythonMessage != undefined) {
      if ((pythonMessage.charAt(0) == '8' && pythonMessage.charAt(1) == '|') || (pythonMessage.charAt(0) == '1' && pythonMessage.charAt(1) == '|') || pythonMessage.charAt(0) == '0') {
        var messageArray = pythonMessage.split('|');
        var powerObj = { ip: `${messageArray[11]}`, power: `${messageArray[7]}` };
        powerArray.push(powerObj);
        return powerObj;
      }
      else {
        return "Null";
      }
    }
    if (pythonMessage == undefined) {
      return "Null";
    }
  });
}


router.get('/power', async function (req, res) {
  const powers = await Power.find();
  res.send(powers);
});

router.post('/power', async function (req, res) {
  powerArray = [];
  var recMes;
  var devices;
  devices = await Device.find().sort('ip');
  for (var i = 0; i < devices.length; i++) {
    var pythonReturn = await powerFunc((devices[i].ip));
    recMes = pythonReturn;
    if (pythonReturn != undefined) {
      if (typeof pythonReturn.ip == 'string' || pythonReturn.ip instanceof String) {
        powerArray.push(pythonReturn);
      }
    }
  }

  //THIS FUNCTION CURRENTLY ONLY WORKS WITH A TIMEOUT. CHANGE IT SO IT WORKS SYNC
  setTimeout(function () {
    var unixTimeStamp = (new Date).getTime();
    var timestampInMilliSeconds = unixTimeStamp;
    var date = new Date(timestampInMilliSeconds);
    var day = (date.getDate() < 10 ? '0' : '') + date.getDate();
    var month = (date.getMonth() < 9 ? '0' : '') + (date.getMonth() + 1);
    var year = date.getFullYear();
    var hours = date.getHours();
    var minutes = (date.getMinutes() < 10 ? '0' : '') + date.getMinutes();
    if (recMes != 'Null') {
      let powerC = new Power({
        date: date,
        time: (hours + ':' + minutes),
        wemos: powerArray
      });
      powerC = powerC.save();
      res.send(JSON.stringify(powerArray));
    }
    else {
      res.send(JSON.stringify("Failed to save Power to Database, try again"));
    }
  }, 1500);
});

router.put('/:id', async (req, res) => {
  const { error } = validate(req.body);
  if (error) return res.status(400).send(error.details[0].message);
  const device = await Device.findByIdAndUpdate(req.params.id, { ip: req.body.ip }, {
    new: true
  });
  if (!genre) return res.status(404).send('The wemo with the given ID was not found.');
  res.send(device);
});

router.delete('/', async (req, res) => {
  var deString = (req.query.id).replace(/\"/g, "");
  deString = deString.replace(/\'/g, "");
  const device = await Device.deleteMany({ ip: { $in: [deString, "OR WHATEVER"] } })
    .then(result => {
      return result;
    });
  if (!device) return res.status(404).send('The wemo with the given ID was not found.');
  res.send(device);
});

router.get('/:id', async (req, res) => {
  const device = await Device.findById(req.params.id);
  if (!device) return res.status(404).send('The wemo with the given IP was not found.');
  res.send(device);
});
module.exports = router;