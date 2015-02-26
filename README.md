# sinopia-gitlab

**The functioning of this plugin is dependent on [this](https://github.com/rlidwka/sinopia/pull/207) pull request.  This plugin will not be published to npm until sinopia has support for it.**

Sinopia plugin for Gitlab authentication and package access/publish authorization.

This plugin allows authentication to Sinopia using a gitlab username and password.  It also checks access levels
for users and projects before allowing access to project code (minimum level "Reporter") or publish access
(minimum level "Master").

## Configuration

````
auth:
  gitlab:
    gitlab_server: https://git.example.com

packages:
  'prefix-*':
    plugin:
      gitlab:
        gitlab_server: https://git.example.com
        gitlab_admin_username: admin
        gitlab_admin_password: password123

  '*':
    allow_access: $authenticated
    allow_publish: []
    proxy: npmjs

````
