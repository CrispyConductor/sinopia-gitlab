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

test('Default config', testFn(
  {},
  '@ns/scope-name',
  'ns/scope-name'
));

test('Prefixed', testFn(
  {
    gitlab_project_prefix: 'my-',
    gitlab_use_scope_as_group: false,
    gitlab_namespaces: [],
    gitlab_retain_group: false,
  },
  '@ns/scope-name',
  'ns/my-scope-name'
));

test('Use scope as group', testFn(
  {
    gitlab_project_prefix: '',
    gitlab_use_scope_as_group: true,
    gitlab_namespaces: [],
    gitlab_retain_group: false,
  },
  '@ns/scope-name',
  'scope/name'
));

test('Namespace', testFn(
  {
    gitlab_project_prefix: '',
    gitlab_use_scope_as_group: false,
    gitlab_namespaces: ['npm'],
    gitlab_retain_group: false,
  },
  '@ns/scope-name',
  'npm/scope-name'
));

test('Namespace, use scope as group, prefixed', testFn(
  {
    gitlab_project_prefix: 'my-',
    gitlab_use_scope_as_group: true,
    gitlab_namespaces: ['npm'],
    gitlab_retain_group: false,
  },
  '@ns/scope-name',
  'npm/my-name'
));

test('Retain group, namespace, prefixed', testFn(
  {
    gitlab_project_prefix: 'my-',
    gitlab_use_scope_as_group: false,
    gitlab_namespaces: ['npm'],
    gitlab_retain_group: true,
  },
  '@ns/scope-name',
  'npm/ns/my-scope-name'
));

test('Retain group, namespace, use scope as group, prefixed', testFn(
  {
    gitlab_project_prefix: 'my-',
    gitlab_use_scope_as_group: true,
    gitlab_namespaces: ['npm'],
    gitlab_retain_group: true,
  },
  '@ns/scope-name',
  'npm/ns/scope/my-name'
));
