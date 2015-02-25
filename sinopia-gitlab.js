var LRU = require('lru-cache');
var GitlabClient = require('./gitlab-client');

/* This isn't defined as a class variable because Sinopia will actually instantiate
 * this plugin twice; once for authentication, and once for authorization/packages,
 * and we need to share some things - notably, the user's gitlab private token.
 * All cached values follow this format: { data: {...}, added: new Date().getTime() }
 * The entries can be one of the following (key -- data):
 * auth-<username> -- { password: "user password" }
 * token-<username> -- "gitlab private token"
 * user-<username> -- { ...gitlab user data... }
 * project-<sinopia package name> -- { ...gitlab project data... }
 * groupmember-<gitlab group id>-<user id> -- { ...gitlab group member data... }
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
	if(maxAge && new Date().getTime() - val.added > maxAge * 1000) {
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
	this.adminUsername = settings.gitlab_admin_username;
	this.adminPassword = settings.gitlab_admin_password;
	this.searchNamespaces = settings.gitlab_namespaces || null;
}

SinopiaGitlab.prototype._getAdminToken = function(cb) {
	var self = this;
	var cached = cacheGet('token-' + this.adminUsername, 3600);
	if(cached) return cb(null, cached);
	this.gitlab.auth(this.adminUsername, this.adminPassword, function(error, user) {
		if(error) return cb(error);
		cacheSet('user-' + self.adminUsername, user);
		cacheSet('token-' + user.private_token, user.private_token);
		cb(null, user.private_token);
	});
};

SinopiaGitlab.prototype._getGitlabUser = function(username, cb) {
	var cached = cacheGet('user-' + username, 3600);
	if(cached) return cb(null, cached);
	var self = this;
	self._getAdminToken(function(error, token) {
		if(error) return cb(error);
		self.gitlab.listUsers(username, token, function(error, results) {
			if(error) return cb(error);
			results = results.filter(function(user) {
				return user.username === username || user.email.toLowerCase() === username.toLowerCase();
			});
			if(!results.length) return cb(new Error('Could not find user ' + username));
			cacheSet('user-' + username, results[0]);
			cb(null, results[0]);
		});
	});
};

SinopiaGitlab.prototype._getGitlabProject = function(packageName, cb) {
	var self = this;
	var cached = cacheGet('project-' + packageName, 3600);
	if(cached) {
		setImmediate(function() {
			cb(null, cached);
		});
		return;
	}
	self._getAdminToken(function(error, token) {
		if(error) return cb(error);
		self.gitlab.listProjects(packageName, token, function(error, results) {
			if(error) return cb(error);
			if(self.searchNamespaces) {
				results = results.filter(function(project) {
					if(self.searchNamespaces.indexOf(project.namespace.path) === -1) {
						return false;
					} else {
						return true;
					}
				});
			}
			if(!results.length) return cb(new Error('Project not found: ' + packageName));
			var project = results[0];
			cacheSet('project-' + packageName, project);
			cb(null, project);
		});
	});
};

SinopiaGitlab.prototype._getGitlabProjectMember = function(projectId, userId, cb) {
	var self = this;
	self._getAdminToken(function(error, token) {
		if(error) return cb(error);
		self.gitlab.getProjectTeamMember(projectId, userId, token, cb);
	});
};

SinopiaGitlab.prototype._getGitlabGroupMember = function(groupId, userId, cb) {
	var self = this;
	var cached = cacheGet('groupmember-' + groupId + '-' + userId, 600);
	if(cached) {
		setImmediate(function() {
			cb(null, cached);
		});
		return;
	}
	self._getAdminToken(function(error, token) {
		if(error) return cb(error);
		self.gitlab.listGroupMembers(groupId, token, function(error, members) {
			if(error) return cb(error);
			members = members.filter(function(member) {
				return member.id === userId;
			});
			if(!members.length) return cb(null, null);
			cacheSet('groupmember-' + groupId + '-' + userId, members[0]);
			cb(null, members[0]);
		});
	});
};

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
			cacheSet('token-' + username, user.private_token);
			cb(null, [username]);
		}
	});
};

SinopiaGitlab.prototype.adduser = function(username, password, cb) {
	this.authenticate(username, password, cb);
};

SinopiaGitlab.prototype.allow_access = function(packageName, user, cb) {
	// on error: cb(error)
	// on access allowed: cb(null, true)
	// on access denied: cb(null, false)
	// user is either { name: "username", groups: [...], real_groups: [...] }
	// or (if anonymous) { name: undefined, groups: [...], real_groups: [...] }
	var self = this;
	function granted() {
		cacheSet('access-' + packageName + '-' + (user.name || 'undefined'), true);
		cb(null, true);
	}
	function denied() {
		cb(null, false);
	}
	if(cacheGet('access-' + packageName + '-' + (user.name || 'undefined'), 900)) {
		setImmediate(function() {
			cb(null, true);
		});
		return;
	}
	self._getGitlabProject(packageName, function(error, project) {
		if(error) return cb(error);
		if(project.visibility_level >= 20) {
			// accessible to anyone
			return granted();
		} else if(project.visibility_level >= 10) {
			// accessible to logged in users
			if(user.name) return granted();
		}
		// Only accessible if explicit access is granted
		if(!user.name) return denied();
		self._getGitlabUser(user.name, function(error, gitlabUser) {
			if(error) return cb(error);
			self._getGitlabProjectMember(project.id, gitlabUser.id, function(error, teamMember) {
				if(error) return cb(error);
				if(teamMember && teamMember.access_level >= 20) return granted();	// level 20 is "reporter", the minimum required to access the code
				self._getGitlabGroupMember(project.namespace.id, gitlabUser.id, function(error, groupMember) {
					if(error) return cb(error);
					if(groupMember && groupMember.access_level >= 20) return granted();
					denied();
				});
			});
		});
	});
};

SinopiaGitlab.prototype.allow_publish = function(packageName, user, cb) {
	var self = this;
	function granted() {
		cacheSet('publish-' + packageName + '-' + (user.name || 'undefined'), true);
		cb(null, true);
	}
	function denied() {
		cb(null, false);
	}
	if(cacheGet('publish-' + packageName + '-' + (user.name || 'undefined'), 900)) {
		setImmediate(function() {
			cb(null, true);
		});
		return;
	}
	self._getGitlabProject(packageName, function(error, project) {
		if(error) return cb(error);
		// Only accessible if explicit access is granted
		if(!user.name) return denied();
		self._getGitlabUser(user.name, function(error, gitlabUser) {
			if(error) return cb(error);
			self._getGitlabProjectMember(project.id, gitlabUser.id, function(error, teamMember) {
				if(error) return cb(error);
				if(teamMember && teamMember.access_level >= 40) return granted();	// level 40 is "master"
				self._getGitlabGroupMember(project.namespace.id, gitlabUser.id, function(error, groupMember) {
					if(error) return cb(error);
					if(groupMember && groupMember.access_level >= 40) return granted();
					denied();
				});
			});
		});
	});
};

module.exports = function(settings, params) {
	return new SinopiaGitlab(settings, params);
};
