var request = require('request');
var async = require('async');

function GitlabClient(url) {
	this.url = url + '/api/v3/';
}

GitlabClient.prototype.auth = function(username, password, cb) {
	var isEmail = username.indexOf('@') !== -1;
	var params = {
		url: this.url + 'session',
		method: 'POST',
		json: {
			login: isEmail ? undefined : username,
			email: isEmail ? username : undefined,
			password: password
		}
	};
	request(params, function(error, response, body) {
		if(error) return cb(error);
		if(response.statusCode < 200 || response.statusCode >= 300) return cb('Invalid status code ' + response.statusCode);
		cb(null, body);
	});
};

GitlabClient.prototype.paginate = function(params, cb) {
	params.qs.per_page = 50;
	params.qs.page = 1;
	var results = [];
	var hasMore = true;
	async.whilst(function() {
		return hasMore;
	}, function(next) {
		console.log('Requesting page=' + params.qs.page);
		request(params, function(error, response, body) {
			if(error) return cb(error);
			if(response.statusCode < 200 || response.statusCode >= 300) return next('Invalid status code ' + response.statusCode);
			body = JSON.parse(body);
			console.log(body.length);
			Array.prototype.push.apply(results, body);
			if(!body.length) hasMore = false;
			params.qs.page++;
			next();
		});
	}, function(error) {
		if(error) return cb(error);
		cb(null, results);
	});
};

GitlabClient.prototype.listAllProjects = function(privateToken, cb) {
	this.paginate({
		url: this.url + 'projects/all',
		qs: {
			private_token: privateToken
		}
	}, cb);
};

GitlabClient.prototype.getProject = function(id, privateToken, cb) {
	request({
		url: this.url + 'projects/' + encodeURIComponent(id),
		qs: {
			private_token: privateToken
		}
	}, function(error, response, body) {
		if(error) return cb(error);
		if(response.statusCode < 200 || response.statusCode >= 300) return cb('Invalid status code ' + response.statusCode);
		cb(null, JSON.parse(body));
	});
};

GitlabClient.prototype.listProjects = function(search, privateToken, cb) {
	this.paginate({
		url: this.url + 'projects',
		qs: {
			private_token: privateToken,
			search: search
		}
	}, cb);
};



var cli = new GitlabClient('');
/*cli.auth('cbreneman', '', function(error, res) {
	console.log(error, res);
});*/

/*cli.listAllProjects('', function(e, r) {
	console.log(e, r);
});*/

cli.listAllProjects('', function(e, r) {
	console.log(e, r);
	console.log(r.length);
});

