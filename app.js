'use strict';

// Library Imports
var express = require('express')
	, bodyParser = require('body-parser')
	, https = require('https')
	, cfenv = require('cfenv');

// Define ExpresJS app
var app = express();

app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json()); // for parsing JSONs from http requests

var appEnv = cfenv.getAppEnv();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var config = null;
var credentials = null;

// process.env gives us the environment variables
if (process.env.VCAP_SERVICES) {
	config = JSON.parse(process.env.VCAP_SERVICES);

	var iotService = config['iotf-service'];
	for (var index in iotService) {
		if (iotService[index].name === 'iotp-for-phone') {
			credentials = iotService[index].credentials;
		}
	}
} else {
	console.log("ERROR: IoT Service was not bound!");
}

var basicConfig = {
	org: credentials.org,
	apiKey: credentials.apiKey,
	apiToken: credentials.apiToken
};

// IoT Platform authentication info
var options = {
	host: 'internetofthings.ibmcloud.com',
	port: 443,
	headers: {
	  'Content-Type': 'application/json'
	},
	auth: basicConfig.apiKey + ':' + basicConfig.apiToken
};

// When user makes a GET request to '/credentials'
app.get('/credentials', function(req, res) {
	// Return this JSON to the user
	res.json(basicConfig);
});

app.get('/iotServiceLink', function(req, res) {
	var options = {
		host: basicConfig.org + '.internetofthings.ibmcloud.com',
		port: 443,
		headers: {
		  'Content-Type': 'application/json'
		},
		auth: basicConfig.apiKey + ':' + basicConfig.apiToken,
		method: 'GET',
		path: 'api/v0002/'
	}
	var org_req = https.request(options, function(org_res) {
		var str = '';
		org_res.on('data', function(chunk) {
			str += chunk;
		});
		org_res.on('end', function() {
			try {
				var org = JSON.parse(str);
					var url = "https://bluemix.net/services/" + org.bluemix.serviceInstanceGuid + "?ace_config=%7B%22orgGuid%22%3A%22" + org.bluemix.organizationGuid + "%22%2C%22spaceGuid%22%3A%22" + org.bluemix.spaceGuid;
				res.json({ url: url });
			} catch (e) { console.log("Something went wrong...", str); res.send(500); }
			console.log("iotServiceLink end: ", str.toString());
		});
	}).on('error', function(e) { console.log("ERROR", e); });
	org_req.end();
});

// When user makes a POST request to '/registerDevice'
app.post('/registerDevice', function(req, res) {
	console.log(req.body);

	var deviceId = null, typeId = "iot-phone", password = null;
	if (req.body.deviceId) { deviceId = req.body.deviceId; }
	if (req.body.typeId) { typeId = req.body.typeId; }
	if (req.body.password) { password = req.body.password; }

	var options = {
		host: basicConfig.org + '.internetofthings.ibmcloud.com',
		port: 443,
		headers: {
		  'Content-Type': 'application/json'
		},
		auth: basicConfig.apiKey + ':' + basicConfig.apiToken,
		method: 'POST',
		path: 'api/v0002/device/types'
	};

	var deviceTypeDetails = {
		id: typeId
	};
	console.log(deviceTypeDetails);

	var type_req = https.request(options, function(type_res) {
		var str = '';
		type_res.on('data', function(chunk) {
			str += chunk;
		});
		type_res.on('end', function() {
			console.log("createDeviceType end: ", str.toString());

			var dev_options = {
				host: basicConfig.org + '.internetofthings.ibmcloud.com',
				port: 443,
				headers: {
				  'Content-Type': 'application/json'
				},
				auth: basicConfig.apiKey + ':' + basicConfig.apiToken,
				method: 'POST',
				path: 'api/v0002/device/types/'+typeId+'/devices'
			}

			var deviceDetails = {
				deviceId: deviceId,
				authToken: password
			};
			console.log(deviceDetails);

			var dev_req = https.request(dev_options, function(dev_res) {
				var str = '';
				dev_res.on('data', function(chunk) {
					str += chunk;
				});
				dev_res.on('end', function() {
					console.log("createDevice end: ", str.toString());
					res.send({ result: "Success!" });
				});
			}).on('error', function(e) { console.log("ERROR", e); });
			dev_req.write(JSON.stringify(deviceDetails));
			dev_req.end();
		});
	}).on('error', function(e) { console.log("ERROR", e); });

	type_req.write(JSON.stringify(deviceTypeDetails));
	type_req.end();
});

// Start the server on the port specified in the app environment
app.listen(appEnv.port, function() {
	console.log("server starting on " + appEnv.url);
});
