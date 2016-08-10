# sinopia-gitlab

Sinopia plugin for Gitlab authentication and package access/publish authorization.

This plugin allows authentication to Sinopia using a gitlab username and password.  It also checks access levels
for users and projects before allowing access to project code (minimum level "Reporter") or publish access
(minimum level "Master").

## Configuration

````
auth:
  gitlab:
    gitlab_server: https://git.example.com
    gitlab_admin_private_token: XXXXXXXXXXXX    # You can use private token here (recommended)
    #gitlab_admin_username: admin               # or provide username and password
    #gitlab_admin_password: password123

packages:
  'prefix-*':
    gitlab: true

  '*':
    allow_access: $authenticated
    allow_publish: []
    proxy: npmjs

````
