var SinopiaGitlab = require('../sinopia-gitlab');

testFn = (settings, input, expected) => {
  return () => {
    var sinopiaGitlab = SinopiaGitlab(settings, {_test_config: true});
    sinopiaGitlab._testConfig(input, function(err, result) {
      expect(err).toBe(null);
      expect(result).toBe(expected);
    });
  };
};

test('Default config#1', testFn(
  {},
  '@ns/scope-name',
  'ns/scope-name'
));

test('Default config#2', testFn(
  {},
  'scope-name',
  'scope-name'
));

test('Prefixed#1', testFn(
  {
    gitlab_project_prefix: 'my-',
    gitlab_use_scope_as_group: false,
    gitlab_namespaces: [],
    gitlab_retain_group: false,
  },
  '@ns/scope-name',
  'ns/my-scope-name'
));

test('Prefixed#2', testFn(
  {
    gitlab_project_prefix: 'my-',
    gitlab_use_scope_as_group: false,
    gitlab_namespaces: [],
    gitlab_retain_group: false,
  },
  'scope-name',
  'my-scope-name'
));

test('Use scope as group#1', testFn(
  {
    gitlab_project_prefix: '',
    gitlab_use_scope_as_group: true,
    gitlab_namespaces: [],
    gitlab_retain_group: false,
  },
  '@ns/scope-name',
  'scope/name'
));

test('Use scope as group#2', testFn(
  {
    gitlab_project_prefix: '',
    gitlab_use_scope_as_group: true,
    gitlab_namespaces: [],
    gitlab_retain_group: false,
  },
  'scope-name',
  'scope/name'
));

test('Namespace#1', testFn(
  {
    gitlab_project_prefix: '',
    gitlab_use_scope_as_group: false,
    gitlab_namespaces: ['npm'],
    gitlab_retain_group: false,
  },
  '@ns/scope-name',
  'npm/scope-name'
));

test('Namespace#2', testFn(
  {
    gitlab_project_prefix: '',
    gitlab_use_scope_as_group: false,
    gitlab_namespaces: ['npm'],
    gitlab_retain_group: false,
  },
  'scope-name',
  'npm/scope-name'
));

test('Namespace, use scope as group, prefixed#1', testFn(
  {
    gitlab_project_prefix: 'my-',
    gitlab_use_scope_as_group: true,
    gitlab_namespaces: ['npm'],
    gitlab_retain_group: false,
  },
  '@ns/scope-name',
  'npm/my-name'
));

test('Namespace, use scope as group, prefixed#2', testFn(
  {
    gitlab_project_prefix: 'my-',
    gitlab_use_scope_as_group: true,
    gitlab_namespaces: ['npm'],
    gitlab_retain_group: false,
  },
  'scope-name',
  'npm/my-name'
));

test('Retain group, namespace, prefixed#1', testFn(
  {
    gitlab_project_prefix: 'my-',
    gitlab_use_scope_as_group: false,
    gitlab_namespaces: ['npm'],
    gitlab_retain_group: true,
  },
  '@ns/scope-name',
  'npm/ns/my-scope-name'
));

test('Retain group, namespace, prefixed#2', testFn(
  {
    gitlab_project_prefix: 'my-',
    gitlab_use_scope_as_group: false,
    gitlab_namespaces: ['npm'],
    gitlab_retain_group: true,
  },
  'scope-name',
  'npm/my-scope-name'
));

test('Retain group, namespace, use scope as group, prefixed#1', testFn(
  {
    gitlab_project_prefix: 'my-',
    gitlab_use_scope_as_group: true,
    gitlab_namespaces: ['npm'],
    gitlab_retain_group: true,
  },
  '@ns/scope-name',
  'npm/ns/scope/my-name'
));

test('Retain group, namespace, use scope as group, prefixed#2', testFn(
  {
    gitlab_project_prefix: 'my-',
    gitlab_use_scope_as_group: true,
    gitlab_namespaces: ['npm'],
    gitlab_retain_group: true,
  },
  'scope-name',
  'npm/scope/my-name'
));
