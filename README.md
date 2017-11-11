# sinopia-gitlab

Sinopia plugin for Gitlab authentication and package access/publish authorization.

This plugin allows authentication to Sinopia using a gitlab username and password.  It also checks access levels
for users and projects before allowing access to project code (minimum level "Reporter") or publish access
(minimum level "Master").

# Configuration

````yml
auth:
  gitlab:
    gitlab_server: https://git.example.com
    gitlab_admin_private_token: XXXXXXXXXXXX    # (Recommended) You can use private token here
    #gitlab_admin_username: admin               # or provide username and password
    #gitlab_admin_password: password123
    #gitlab_namespaces: [group, .....]          # (Optional) Persistent gitlab group (Default empty => off)
    gitlab_use_scope_as_group: false            # (Optional) Match scope as group (Default false)group/scope-project
    gitlab_project_prefix: npm-                 # (Optional) Use this if you prefix your projects in gitlab
    gitlab_retain_group: false                  # (Optional) Use this to retain group name when perform project name conversion

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

# Test your configuration
```javascript
// Import
var SinopiaGitlab = require('sinopia-gitlab');
// Initialize
var sinopiaGitlab = SinopiaGitlab({
  // your configuration goes here
  gitlab_project_prefix: '',
  gitlab_use_scope_as_group: false,
  gitlab_namespaces: [],
  gitlab_retain_group: false
}, {
  // Set environment to test config
  _test_config: true
});

// Run test
var packageName = '@ns/scope-name';
sinopiaGitlab._testConfig(packageName, function(err, result) {
  // Check the conversion result
  console.log(result);
});
```

# Package name to GitLab project name conversion

```javascript
// This only show the process of conversion of one entry of gitlab_namespaces
// package name is '@ns/scope-name'

i = 0

if (gitlab_use_scope_as_group)
    namespace = gitlab_retain_group ? 'ns/scope' : 'scope'
else
    namespace = 'ns'

project = gitlab_project_prefix + 'name'

if (gitlab_namespaces[i])
    namespace = gitlab_retain_group ? namespace + '/' + gitlab_namespaces[i] : gitlab_namespaces[i]
```

# Configuration examples
## Default:

```yml
gitlab_project_prefix: ''
gitlab_use_scope_as_group: false
gitlab_namespaces: []
gitlab_retain_group: false
```

| NPM Project Name      | GitLab Project Name  |
|-----------------------|----------------------|
| project-a             | project-a            |
| @mysterious/project-b | mysterious/project-b |

## Config 1: prefixed

```yml
gitlab_project_prefix: 'my-'
gitlab_use_scope_as_group: false
gitlab_namespaces: []
gitlab_retain_group: false
```

| NPM Project Name      | GitLab Project Name     |
|-----------------------|-------------------------|
| project-a             | my-project-a            |
| @mysterious/project-b | mysterious/my-project-b |

## Config 2: use scope as group

```yml
gitlab_project_prefix: ''
gitlab_use_scope_as_group: true
gitlab_namespaces: []
gitlab_retain_group: false
```

| NPM Project Name      | GitLab Project Name     |
|-----------------------|-------------------------|
| project-a             | project/a               |
| @mysterious/project-b | project/b               |

## Config 3: namespace

```yml
gitlab_project_prefix: ''
gitlab_use_scope_as_group: false
gitlab_namespaces: [npm]
gitlab_retain_group: false
```

| NPM Project Name      | GitLab Project Name      |
|-----------------------|--------------------------|
| project-a             | npm/project-a            |
| @mysterious/project-b | npm/project-b            |

## Config 4: namespace, use scope as group, prefixed

```yml
gitlab_project_prefix: 'my-'
gitlab_use_scope_as_group: true
gitlab_namespaces: [npm]
gitlab_retain_group: false
```
| NPM Project Name      | GitLab Project Name                 |
|-----------------------|-------------------------------------|
| project-a             | npm/my-a                            |
| @mysterious/project-b | npm/my-b                            |

## Config 5: retain group, namespace, prefixed

```yml
gitlab_project_prefix: 'my-'
gitlab_use_scope_as_group: false
gitlab_namespaces: [npm]
gitlab_retain_group: true

```
| NPM Project Name      | GitLab Project Name                 |
|-----------------------|-------------------------------------|
| project-a             | npm/my-project-a                    |
| @mysterious/project-b | npm/mysterious/my-project-b         |

## Config 6: retain group, use scope as group namespace, prefixed

```yml
gitlab_project_prefix: 'my-'
gitlab_use_scope_as_group: true
gitlab_namespaces: [npm]
gitlab_retain_group: true
```

| NPM Project Name      | GitLab Project Name                 |
|-----------------------|-------------------------------------|
| project-a             | npm/project/my-a                    |
| @mysterious/project-b | npm/mysterious/project/my-b         |
