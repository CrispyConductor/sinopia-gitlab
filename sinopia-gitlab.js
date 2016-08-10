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

// Map from keys to arrays of callbacks
var cacheInProgress = {};

// Get value from cache if exists, or call miss function to fetch it
// If a `miss` is already in progress, it waits for that to complete instead
// When `miss` completes, sets the cache result (if not an error or undefined)
// `miss` is in this form: function(key, extraParams, cb)
// Params:
// key - The cache key to get/set
// extraParams - Additional parameters used to look up the result, used as
//   additional components to `key` if cache entry is not found.
// maxAge - Same as cacheGet()
// miss - See above
function checkCache(key, extraParams, maxAge, miss, cb) {
	var val = cacheGet(key, maxAge);
	if (val === undefined) {
		var inProgressKey = '' + key + '!!!' + JSON.stringify(extraParams || null);
		if (cacheInProgress[inProgressKey]) {
			cacheInProgress[inProgressKey].push(cb);
		} else {
			cacheInProgress[inProgressKey] = [cb];
			miss(key, extraParams, function(error, result, cacheResult) {
				if (!error && cacheResult !== false) {
					cacheSet(key, result);
				}
				var callbacks = cacheInProgress[inProgressKey];
				delete cacheInProgress[inProgressKey];
				setImmediate(function() {
					callbacks.forEach(function(resultCb) {
						resultCb(error, result);
					});
				});
			});
		}
	} else {
		setImmediate(function() {
			cb(null, val);
		});
	}
}

function SinopiaGitlab(settings, params) {
	this.settings = settings;
	this.logger = params.logger;
	this.sinopiaConfig = params.config;
	if(!settings.gitlab_server) throw new Error('sinopia-gitlab missing config option gitlab_server');
	this.gitlab = new GitlabClient(settings.gitlab_server);
	this.adminPrivateToken = settings.gitlab_admin_private_token;
	this.adminUsername = settings.gitlab_admin_username;
	this.adminPassword = settings.gitlab_admin_password;
	this.searchNamespaces = settings.gitlab_namespaces || null;
	this.useScopeAsGroup = settings.gitlab_use_scope_as_group || false;
	this.projectPrefix = settings.gitlab_project_prefix || '';
}

SinopiaGitlab.prototype._getAdminToken = function(cb) {
	var self = this;
	if (self.adminPrivateToken) {
		cb(null, self.adminPrivateToken);
	} else {
		checkCache('token-' + self.adminUsername, null, 3600, function(key, extraParams, cb) {
			self.gitlab.auth(self.adminUsername, self.adminPassword, function(error, user) {
				if(error) return cb(error);
				cacheSet('user-' + self.adminUsername, user);
				cb(null, user.private_token);
			});
		}, cb);
	}
};

SinopiaGitlab.prototype._getGitlabUser = function(username, cb) {
	var self = this;
	checkCache('user-' + username, null, 3600, function(key, extraParams, cb) {
		self._getAdminToken(function(error, token) {
			self.gitlab.listUsers(username, token, function(error, results) {
				if(error) return cb(error);
				results = results.filter(function(user) {
					return user.username === username || user.email.toLowerCase() === username.toLowerCase();
				});
				if(!results.length) return cb(new Error('Could not find user ' + username));
				cb(null, results[0]);
			});
		});
	}, cb);
};

SinopiaGitlab.prototype._getGitlabProject = function(packageName, cb) {
	var self = this;
	checkCache('project-' + packageName, null, 3600, function(key, extraParams, cb) {
		self._getAdminToken(function(error, token) {
			if(error) return cb(error);
			var projectName;
			var groupName;
			var parts = packageName.split('/');
			if (parts.length === 1) {
				projectName = parts[0];
			} else if (parts.length === 2) {
				groupName = parts[0].replace('@', '');
				projectName = parts[1];
			} else {
				return cb(new Error('Incorrect package name: ' + packageName));
			}
			if (self.projectPrefix) {
				projectName = self.projectPrefix + projectName;
			}
			self.gitlab.listProjects(packageName, token, function(error, results) {
				if(error) return cb(error);
				if(self.searchNamespaces) {
					results = results.filter(function(project) {
						if (self.useScopeAsGroup) {
							return project.namespace.path === groupName;
						} else {
							if(self.searchNamespaces.indexOf(project.namespace.path) === -1) {
								return false;
							} else {
								return true;
							}
						}
					});
				}
				if(!results.length) return cb(new Error('Project not found: ' + packageName));
				var project = results[0];
				cb(null, project);
			});
		});
	}, cb);
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
	checkCache('groupmember-' + groupId + '-' + userId, null, 600, function(key, extraParams, cb) {
		self._getAdminToken(function(error, token) {
			if(error) return cb(error);
			self.gitlab.listGroupMembers(groupId, token, function(error, members) {
				if(error) return cb(error);
				members = members.filter(function(member) {
					return member.id === userId;
				});
				if(!members.length) return cb(null, null);
				cb(null, members[0]);
			});
		});
	}, cb);
};

SinopiaGitlab.prototype.authenticate = function(username, password, cb) {
	// on error: cb(error)
	// on user not found: cb(null, undefined)
	// on failed password: cb(null, false)
	// on success: cb(null, [username, groups...])
	var self = this;
	checkCache('auth-' + username, password, 900, function(key, extraParams, cb) {
		self.gitlab.auth(username, password, function(error, user) {
			if(error) {
				self.logger.error('Error authenticating to gitlab: ' + error);
				cb(null, false, false);
			} else {
				cacheSet('user-' + username, user);
				cacheSet('token-' + username, user.private_token);
				cb(null, {
					password: password
				});
			}
		});
	}, function(error, cachedAuth) {
		if (cachedAuth.password !== password) {
			return cb(new Error('Password does not match'));
		}
		self._getGitlabUser(username, function(error) {
			if (error) return cb(error);
			cb(null, [username]);
		});
	});
};

SinopiaGitlab.prototype.adduser = function(username, password, cb) {
	this.authenticate(username, password, cb);
};

SinopiaGitlab.prototype.allow_access = function(user, package, cb) {
	// on error: cb(error)
	// on access allowed: cb(null, true)
	// on access denied: cb(null, false)
	// user is either { name: "username", groups: [...], real_groups: [...] }
	// or (if anonymous) { name: undefined, groups: [...], real_groups: [...] }
	var self = this;
	var packageName = package.name;
	if (!package.gitlab) {
		// public package or something that's not handled with this plugin
		return cb(null, false);
	}
	function granted() {
		cacheSet('access-' + packageName + '-' + (user.name || 'undefined'), true);
		cb(null, true);
	}
	function denied() {
		var err = Error('access denied');
		err.status = 403;
		cb(err);
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

SinopiaGitlab.prototype.allow_publish = function(user, package, cb) {
	var self = this;
	var packageName = package.name;
	if (!package.gitlab) {
		// public package or something that's not handled with this plugin
		return cb(null, false);
	}
	function granted() {
		cacheSet('publish-' + packageName + '-' + (user.name || 'undefined'), true);
		cb(null, true);
	}
	function denied() {
		var err = Error('access denied');
		err.status = 403;
		cb(err);
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
