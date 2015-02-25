var LRU = require('lru-cache');
var GitlabClient = require('./gitlab-client');

/* This isn't defined as a class variable because Sinopia will actually instantiate
 * this plugin twice; once for authentication, and once for authorization/packages,
 * and we need to share some things - notably, the user's gitlab private token.
 * All cached values follow this format: { data: {...}, added: new Date().getTime() }
 * The entries can be one of the following (key -- data):
 * auth-<username> -- { password: "user password" }
 * user-<username> -- { ...gitlab user data... }
 * project-<sinopia package name> -- { ...gitlab project data... }
 * projectmember-<sinopia package name>-<username> -- { ...gitlab project member... }
 * groupmember-<gitlab group id>-<username> -- { ...gitlab group member data... }
 * access-<sinopia package name>-<username> -- true
 * publish-<sinopia package name>-<username> -- true
 */
var cache = LRU({
	max: 1000
});

// maxAge is in seconds
function cacheGet(key, maxAge) {
	var val = cache.get(key);
	if(!val) return undefined;
	if(new Date().getTime() - val.added > maxAge * 1000) {
		cache.del(key);
		return undefined;
	}
	return val.data;
}

function cacheSet(key, val) {
	cache.set(key, {
		data: val,
		added: new Date().getTime()
	});
}

function SinopiaGitlab(settings, params) {
	this.settings = settings;
	this.logger = params.logger;
	this.sinopiaConfig = params.config;
	if(!settings.gitlab_server) throw new Error('sinopia-gitlab missing config option gitlab_server');
	this.gitlab = new GitlabClient(settings.gitlab_server);
}

SinopiaGitlab.prototype.authenticate = function(username, password, cb) {
	// on error: cb(error)
	// on user not found: cb(null, undefined)
	// on failed password: cb(null, false)
	// on success: cb(null, [username, groups...])
	var self = this;
	var cachedAuth = cacheGet('auth-' + username, 900);
	if(cachedAuth && cachedAuth.password === password && cacheGet('user-' + username)) {
		setImmediate(function() {
			cb(null, [username]);
		});
		return;
	}
	this.gitlab.auth(username, password, function(error, user) {
		if(error) {
			self.logger.error('Error authenticating to gitlab: ' + error);
			cb(null, false);
		} else {
			cacheSet('auth-' + username, { password: password });
			cacheSet('user-' + username, user);
			cb(null, [username]);
		}
	});
};

SinopiaGitlab.prototype.adduser = function(cb) {
	cb(new Error('Sinopia Gitlab plugin does not support adding users'));
};

SinopiaGitlab.prototype.allow_access = function(packageName, user, cb) {
	// on error: cb(error)
	// on access allowed: cb(null, true)
	// on access denied: cb(null, false)
	// user is either { name: "username", groups: [...], real_groups: [...] }
	// or (if anonymous) { name: undefined, groups: [...], real_groups: [...] }
};

SinopiaGitlab.prototype.allow_publish = function(packageName, user, cb) {

};

module.exports = function(settings, params) {
	return new SinopiaGitlab(settings, params);
};
