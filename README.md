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
    gitlab_admin_private_token: XXXXXXXXXXXX    # (Recommended) You can use private token here
    #gitlab_admin_username: admin               # or provide username and password
    #gitlab_admin_password: password123
    #gitlab_namespaces: [group, .....]          # (Optional) Persistent gitlab group (Default empty => off)
                                                # - example_1 OFF: prefix-project -> git: prefix-project/prefix-project
                                                # - example_2 ON:  prefix-project -> git: group/prefix-project
                                                # - example_1 OFF: @ignore/project -> git: ignore/project
                                                # - example_2 ON:  @ignore/project -> git: groupe/project
    gitlab_use_scope_as_group: false            # (Optional) Match scope as group (Default false)
                                                # - example_1 OFF: scope-project -> git: scope/project
                                                # - example_2 ON:  scope-project -> git: scope-project/scope-project
                                                # - example_1 OFF: @ignore/scope-project -> git: ignore/scope-project
                                                # - example_2 ON:  @ignore/scope-project -> git: scope/project
                                                # - example_1 ON & namespace ON:  @ignore/scope-project -> git: group/scope-project
    gitlab_project_prefix: npm-                 # (Optional) Use this if you prefix your projects in gitlab
                                                # - example_1: prefix-project -> git: prefix-project/npm-prefix-project
                                                # - example_2: @group/project -> git: group/npm-project
                                                # - example_3 namespace ON: prefix-project -> git: group/npm-prefix-project
                                                # - example_4 namespace ON: @ignore/project -> git: group/npm-project

    #gitlab_ca_file: /path/to/ca/ca.crt         # (Optional) Use for self-signed certificates

packages:
  '@*/*':
    gitlab: true

  'scope-*':
    gitlab: true

  'prefix-*':
    gitlab: true

  '*':
    allow_access: $authenticated
    allow_publish: []
    proxy: npmjs

````
