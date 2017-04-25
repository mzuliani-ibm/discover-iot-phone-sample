'use strict';

// Library Imports
var express = require('express')
	, bodyParser = require('body-parser')
	, https = require('https')
	, cfenv = require('cfenv')
	, fs = require('fs')
	, qr = require('qr-image')
	, url = require('url');

// Define ExpresJS app
var app = express();

app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json()); // for parsing JSONs from http requests

var appEnv = cfenv.getAppEnv();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var config = null;
var credentials = null;

function configureCredentials(vcap) {
	config = vcap;

	var iotService = config['iotf-service'];
	credentials = iotService[0].credentials;
}

try {
	var VCAP_SERVICES = require(__dirname + '/VCAP_SERVICES.json');

	configureCredentials(VCAP_SERVICES);
} catch (error) {
	console.log(error);
	console.log("Fallback to Bluemix VCAP_SERVICES");

	if (process.env.VCAP_SERVICES) {
		configureCredentials(JSON.parse(process.env.VCAP_SERVICES));
	} else {
		console.log("ERROR: IoT Service was not bound!");
	}
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
	};

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

app.post('/qrcode', function(req, res) {
	var text = url.parse(req.body.url).href;

    try {
        var imgString = qr.imageSync(text);
		var b64encoded = imgString.toString('base64');
 		var datajpg = "data:image/png;base64," + b64encoded;

		res.status(200).json({img: datajpg});
    } catch (e) {
        res.status(400);
    }
});

// Start the server on the port specified in the app environment
app.listen(appEnv.port, function() {
	console.log("server starting on " + appEnv.url);
});
